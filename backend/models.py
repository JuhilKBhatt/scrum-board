from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from database import Base
import datetime

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String, index=True, nullable=False)
    task_owner = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String, default="Backlog", nullable=False)
    priority = Column(String(1), default="M", nullable=False)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
