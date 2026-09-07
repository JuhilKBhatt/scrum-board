from pydantic import BaseModel
from typing import Optional

class TicketBase(BaseModel):
    task_name: str
    task_owner: Optional[str] = None
    description: Optional[str] = None
    status: str = "Backlog"

class TicketCreate(TicketBase):
    pass

class TicketUpdate(BaseModel):
    task_name: Optional[str] = None
    task_owner: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

class TicketResponse(TicketBase):
    id: int

    class Config:
        from_attributes = True
