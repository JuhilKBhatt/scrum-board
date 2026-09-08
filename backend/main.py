from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
import json

from database import engine, get_db, Base
import models
import schemas

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Scrum Board API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
async def websocket_endpoint(websocket: WebSocket):
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
async def create_ticket(ticket: schemas.TicketCreate, db: Session = Depends(get_db)):
    db_ticket = models.Ticket(**ticket.model_dump())
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    await notify_clients("CREATE", db_ticket)
    return db_ticket

@app.get("/api/tickets/", response_model=List[schemas.TicketResponse])
def get_tickets(db: Session = Depends(get_db)):
    return db.query(models.Ticket).all()

@app.put("/api/tickets/{ticket_id}", response_model=schemas.TicketResponse)
async def update_ticket(ticket_id: int, ticket_update: schemas.TicketUpdate, db: Session = Depends(get_db)):
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
async def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
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

# Only mount static files if the directory exists (which it will in the production Docker image)
if os.path.isdir("static"):
    app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")

    # Catch-all route to serve the React index.html
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        # Ignore API routes
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        
        # Serve requested file if it exists (e.g. favicon, vite.svg)
        if full_path and os.path.isfile(f"static/{full_path}"):
            return FileResponse(f"static/{full_path}")
            
        # Fallback to index.html for client-side routing
        return FileResponse("static/index.html")
