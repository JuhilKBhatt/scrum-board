from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import os
import json
import jwt
import hmac
import datetime

from database import engine, get_db, Base
import models
import schemas

# Create database tables
models.Base.metadata.create_all(bind=engine)

# Auto-migrate remote databases that were created before the new columns were added
from sqlalchemy import text
with engine.begin() as conn:
    # We use engine.begin() which auto-commits. We ignore errors if columns already exist.
    statements = [
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority VARCHAR(1) DEFAULT 'M';"
    ]
    for stmt in statements:
        try:
            conn.execute(text(stmt))
        except Exception as e:
            pass # Fails safely if column exists or dialect doesn't support IF NOT EXISTS

app = FastAPI(title="Scrum Board API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# AUTHENTICATION
# ==========================================
SECRET_KEY = os.getenv("SECRET_KEY")
BOARD_PASSWORD = os.getenv("BOARD_PASSWORD")
ALGORITHM = "HS256"

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

async def verify_ws_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        raise WebSocketDisconnect()

class LoginRequest(BaseModel):
    password: str

@app.post("/api/login")
def login(request: LoginRequest):
    # Constant-time comparison to prevent timing attacks
    if not hmac.compare_digest(request.password, BOARD_PASSWORD):
        raise HTTPException(status_code=401, detail="Incorrect password")
    
    expire = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    token = jwt.encode({"exp": expire, "sub": "board_user"}, SECRET_KEY, algorithm=ALGORITHM)
    return {"token": token}


# ==========================================
# WEBSOCKET MANAGER
# ==========================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()


# ==========================================
# API ENDPOINTS (Prefixed with /api)
# ==========================================

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    # Manually verify token for WebSockets since they don't support custom headers well
    try:
        await verify_ws_token(token)
    except WebSocketDisconnect:
        await websocket.close(code=1008)
        return
        
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

async def notify_clients(action: str, ticket: models.Ticket):
    ticket_dict = schemas.TicketResponse.model_validate(ticket).model_dump_json()
    message = json.dumps({"action": action, "ticket": json.loads(ticket_dict)})
    await manager.broadcast(message)

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/tickets/", response_model=schemas.TicketResponse)
async def create_ticket(ticket: schemas.TicketCreate, db: Session = Depends(get_db), auth: dict = Depends(verify_token)):
    db_ticket = models.Ticket(**ticket.model_dump())
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    await notify_clients("CREATE", db_ticket)
    return db_ticket

@app.get("/api/tickets/", response_model=List[schemas.TicketResponse])
def get_tickets(db: Session = Depends(get_db), auth: dict = Depends(verify_token)):
    return db.query(models.Ticket).all()

@app.put("/api/tickets/{ticket_id}", response_model=schemas.TicketResponse)
async def update_ticket(ticket_id: int, ticket_update: schemas.TicketUpdate, db: Session = Depends(get_db), auth: dict = Depends(verify_token)):
    db_ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    update_data = ticket_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_ticket, key, value)
        
    db.commit()
    db.refresh(db_ticket)
    await notify_clients("UPDATE", db_ticket)
    return db_ticket

@app.delete("/api/tickets/{ticket_id}")
async def delete_ticket(ticket_id: int, db: Session = Depends(get_db), auth: dict = Depends(verify_token)):
    db_ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    db.delete(db_ticket)
    db.commit()
    await notify_clients("DELETE", db_ticket)
    return {"status": "success", "message": "Ticket deleted"}


# ==========================================
# STATIC FILES (React Frontend)
# ==========================================

if os.path.isdir("static"):
    app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        
        if full_path and os.path.isfile(f"static/{full_path}"):
            return FileResponse(f"static/{full_path}")
            
        return FileResponse("static/index.html")
