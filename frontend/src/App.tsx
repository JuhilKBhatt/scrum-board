import { useState, useEffect } from 'react';
import { Button, Modal, Form, Input, Card, Layout, Typography, Tag, Popconfirm, message, Space } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, UserOutlined, AlignLeftOutlined } from '@ant-design/icons';
import './App.css';
import type { Ticket, ColumnType } from './types';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const COLUMNS: ColumnType[] = ['Backlog', 'In Progress', 'Review', 'Done'];

function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_URL}/tickets/`);
      const data = await res.json();
      setTickets(data);
    } catch (err) {
      message.error("Failed to fetch tickets");
    }
  };

  const openCreateModal = () => {
    setEditingTicket(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const openEditModal = (ticket: Ticket) => {
    setEditingTicket(ticket);
    form.setFieldsValue({
      task_name: ticket.task_name,
      task_owner: ticket.task_owner,
      description: ticket.description,
    });
    setIsModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    if (editingTicket) {
      // Update existing ticket
      try {
        const res = await fetch(`${API_URL}/tickets/${editingTicket.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        const updatedTicket = await res.json();
        setTickets(tickets.map(t => t.id === editingTicket.id ? updatedTicket : t));
        message.success("Ticket updated!");
      } catch (err) {
        message.error("Failed to update ticket");
      }
    } else {
      // Create new ticket
      try {
        const res = await fetch(`${API_URL}/tickets/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        const data = await res.json();
        setTickets([...tickets, data]);
        message.success("Ticket created!");
      } catch (err) {
        message.error("Failed to create ticket");
      }
    }
    setIsModalVisible(false);
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
      message.error("Failed to update ticket status");
    }
  };

  const handleDelete = async (ticketId: number) => {
    try {
      await fetch(`${API_URL}/tickets/${ticketId}`, { method: 'DELETE' });
      setTickets(tickets.filter(t => t.id !== ticketId));
      message.success("Ticket deleted");
    } catch (err) {
      message.error("Failed to delete ticket");
    }
  };

  // HTML5 Drag and Drop Handlers
  const onDragStart = (e: React.DragEvent, ticketId: number) => {
    e.dataTransfer.setData("ticketId", ticketId.toString());
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const ticketId = parseInt(e.dataTransfer.getData("ticketId"));
    if (ticketId) {
      handleStatusChange(ticketId, status);
    }
  };

  return (
    <Layout style={{ height: '100vh', background: '#f0f2f5' }}>
      <Header style={{ background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', zIndex: 1 }}>
        <Title level={4} style={{ margin: 0 }}>Scrum Board</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          New Ticket
        </Button>
      </Header>

      <Content style={{ padding: '24px', overflowX: 'auto', display: 'flex', gap: '24px' }}>
        {COLUMNS.map(column => (
          <div 
            key={column} 
            className="board-column"
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, column)}
          >
            <div className="column-header">
              <Text strong style={{ textTransform: 'uppercase', color: '#595959' }}>{column}</Text>
              <Tag color="blue" style={{ margin: 0 }}>{tickets.filter(t => t.status === column).length}</Tag>
            </div>
            
            <div className="ticket-list">
              {tickets.filter(t => t.status === column).map(ticket => (
                <Card
                  key={ticket.id}
                  size="small"
                  className="ticket-card"
                  draggable
                  onDragStart={(e) => onDragStart(e, ticket.id)}
                  title={ticket.task_name}
                  extra={
                    <Space size="small">
                      <Button type="text" icon={<EditOutlined />} size="small" onClick={() => openEditModal(ticket)} />
                      <Popconfirm
                        title="Delete ticket"
                        description="Are you sure you want to delete this ticket?"
                        onConfirm={() => handleDelete(ticket.id)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                      </Popconfirm>
                    </Space>
                  }
                  style={{ marginBottom: 12, cursor: 'grab' }}
                  headStyle={{ fontSize: '14px', borderBottom: '1px solid #f0f0f0' }}
                >
                  {ticket.task_owner && (
                    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, color: '#595959' }}>
                      <UserOutlined />
                      <Text type="secondary" style={{ fontSize: 13 }}>{ticket.task_owner}</Text>
                    </div>
                  )}
                  {ticket.description && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: '#595959', fontSize: 13 }}>
                      <AlignLeftOutlined style={{ marginTop: 4 }} />
                      <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{ticket.description}</Text>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        ))}
      </Content>

      <Modal
        title={editingTicket ? "Edit Ticket" : "Create New Ticket"}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="task_name" label="Task Name" rules={[{ required: true, message: 'Please enter a task name' }]}>
            <Input placeholder="E.g., Implement login page" />
          </Form.Item>
          <Form.Item name="task_owner" label="Task Owner">
            <Input placeholder="E.g., John Doe" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={4} placeholder="Add some details..." />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Button onClick={() => setIsModalVisible(false)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button type="primary" htmlType="submit">
              {editingTicket ? "Save Changes" : "Create Ticket"}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

export default App;
