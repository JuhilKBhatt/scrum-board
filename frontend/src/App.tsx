import { useState, useEffect } from 'react';
import './App.css';
import type { Ticket, ColumnType } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const COLUMNS: ColumnType[] = ['Backlog', 'In Progress', 'Review', 'Done'];

function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTask, setNewTask] = useState({ task_name: '', task_owner: '', description: '' });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_URL}/tickets/`);
      const data = await res.json();
      setTickets(data);
    } catch (err) {
      console.error("Failed to fetch tickets", err);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.task_name) return;

    try {
      const res = await fetch(`${API_URL}/tickets/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      const data = await res.json();
      setTickets([...tickets, data]);
      setNewTask({ task_name: '', task_owner: '', description: '' });
      setIsCreating(false);
    } catch (err) {
      console.error("Failed to create ticket", err);
    }
  };

  const handleStatusChange = async (ticketId: number, newStatus: string) => {
    try {
      const res = await fetch(`${API_URL}/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const updatedTicket = await res.json();
      setTickets(tickets.map(t => t.id === ticketId ? updatedTicket : t));
    } catch (err) {
      console.error("Failed to update ticket", err);
    }
  };

  const handleDelete = async (ticketId: number) => {
    try {
      await fetch(`${API_URL}/tickets/${ticketId}`, { method: 'DELETE' });
      setTickets(tickets.filter(t => t.id !== ticketId));
    } catch (err) {
      console.error("Failed to delete ticket", err);
    }
  };

  // HTML5 Drag and Drop Handlers
  const onDragStart = (e: React.DragEvent, ticketId: number) => {
    e.dataTransfer.setData("ticketId", ticketId.toString());
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const onDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const ticketId = parseInt(e.dataTransfer.getData("ticketId"));
    if (ticketId) {
      handleStatusChange(ticketId, status);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Scrum Board</h1>
        <button className="create-btn" onClick={() => setIsCreating(true)}>+ New Ticket</button>
      </header>

      {isCreating && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Create New Ticket</h2>
            <form onSubmit={handleCreateTicket}>
              <div className="form-group">
                <label>Task Name (Required):</label>
                <input 
                  type="text" 
                  value={newTask.task_name} 
                  onChange={e => setNewTask({...newTask, task_name: e.target.value})} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Task Owner:</label>
                <input 
                  type="text" 
                  value={newTask.task_owner} 
                  onChange={e => setNewTask({...newTask, task_owner: e.target.value})} 
                />
              </div>
              <div className="form-group">
                <label>Description:</label>
                <textarea 
                  value={newTask.description} 
                  onChange={e => setNewTask({...newTask, description: e.target.value})} 
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setIsCreating(false)} className="cancel-btn">Cancel</button>
                <button type="submit" className="save-btn">Save Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="board">
        {COLUMNS.map(column => (
          <div 
            key={column} 
            className="column"
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, column)}
          >
            <div className="column-header">
              <h2>{column}</h2>
              <span className="ticket-count">
                {tickets.filter(t => t.status === column).length}
              </span>
            </div>
            
            <div className="ticket-list">
              {tickets.filter(t => t.status === column).map(ticket => (
                <div 
                  key={ticket.id} 
                  className="ticket-card"
                  draggable
                  onDragStart={(e) => onDragStart(e, ticket.id)}
                >
                  <div className="ticket-header">
                    <h3>{ticket.task_name}</h3>
                    <button onClick={() => handleDelete(ticket.id)} className="delete-btn" title="Delete Ticket">×</button>
                  </div>
                  {ticket.task_owner && <p className="ticket-owner"><strong>Owner:</strong> {ticket.task_owner}</p>}
                  {ticket.description && <p className="ticket-desc">{ticket.description}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
