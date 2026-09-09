from pydantic import BaseModel
from typing import Optional
import datetime

class TicketBase(BaseModel):
    task_name: str
    task_owner: Optional[str] = None
    description: Optional[str] = None
    status: str = "Backlog"
    priority: str = "M"
    is_archived: bool = False

class TicketCreate(TicketBase):
    pass

class TicketUpdate(BaseModel):
    task_name: Optional[str] = None
    task_owner: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    is_archived: Optional[bool] = None

class TicketResponse(TicketBase):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True
