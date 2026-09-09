import { useState, useEffect } from 'react';
import { Button, Modal, Form, Input, Card, Layout, Typography, Tag, Popconfirm, message, Space, Dropdown, List } from 'antd';
import type { MenuProps } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, UserOutlined, AlignLeftOutlined, InboxOutlined, ClockCircleOutlined, MoreOutlined, UndoOutlined } from '@ant-design/icons';
import './App.css';
import type { Ticket, ColumnType } from './types';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const API_URL = import.meta.env.VITE_API_URL || '/api';
const COLUMNS: ColumnType[] = ['Backlog', 'In Progress', 'Review', 'Done'];

function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isArchiveModalVisible, setIsArchiveModalVisible] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [form] = Form.useForm();

  // Fetch initial tickets
  useEffect(() => {
    fetchTickets();
  }, []);

  // Set up Live WebSocket Updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    
    let ws: WebSocket;
    let reconnectInterval: ReturnType<typeof setInterval>;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Connected to Live Updates WebSocket');
        clearInterval(reconnectInterval);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const action = data.action;
        const incomingTicket: Ticket = data.ticket;

        setTickets((prev) => {
          if (action === 'CREATE') {
            if (prev.find(t => t.id === incomingTicket.id)) return prev;
            return [...prev, incomingTicket];
          } 
          else if (action === 'UPDATE') {
            return prev.map(t => t.id === incomingTicket.id ? incomingTicket : t);
          } 
          else if (action === 'DELETE') {
            return prev.filter(t => t.id !== incomingTicket.id);
          }
          return prev;
        });
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected. Reconnecting...');
        reconnectInterval = setInterval(connect, 3000);
      };
    };

    connect();

    return () => {
      clearInterval(reconnectInterval);
      if (ws) {
        ws.onclose = null; // Prevent reconnect loop in StrictMode
        ws.close();
      }
    };
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
      try {
        await fetch(`${API_URL}/tickets/${editingTicket.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        message.success("Ticket updated!");
      } catch (err) {
        message.error("Failed to update ticket");
      }
    } else {
      try {
        await fetch(`${API_URL}/tickets/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        message.success("Ticket created!");
      } catch (err) {
        message.error("Failed to create ticket");
      }
    }
    setIsModalVisible(false);
  };

  const handleStatusChange = async (ticketId: number, newStatus: string) => {
    try {
      await fetch(`${API_URL}/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      message.error("Failed to update ticket status");
    }
  };

  const handleArchiveToggle = async (ticketId: number, isArchived: boolean) => {
    try {
      await fetch(`${API_URL}/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: isArchived }),
      });
      message.success(isArchived ? "Ticket archived" : "Ticket restored");
    } catch (err) {
      message.error("Failed to update archive status");
    }
  };

  const handleDelete = async (ticketId: number) => {
    try {
      await fetch(`${API_URL}/tickets/${ticketId}`, { method: 'DELETE' });
      message.success("Ticket permanently deleted");
    } catch (err) {
      message.error("Failed to delete ticket");
    }
  };

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

  const formatDate = (dateString: string) => {
    // Append 'Z' to treat the naive backend timestamp as UTC explicitly
    const utcDateString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
    const d = new Date(utcDateString);
    return d.toLocaleString('en-AU', { 
      timeZone: 'Australia/Sydney',
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const activeTickets = tickets.filter(t => !t.is_archived);
  const archivedTickets = tickets.filter(t => t.is_archived);

  // Helper to generate the "Move To" menu for mobile/click users
  const getMoveMenu = (ticketId: number): MenuProps => {
    return {
      items: COLUMNS.map(col => ({
        key: col,
        label: `Move to ${col}`,
        onClick: () => handleStatusChange(ticketId, col)
      }))
    };
  };

  return (
    <Layout style={{ height: '100vh', background: '#f0f2f5' }}>
      <Header style={{ background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', zIndex: 1 }}>
        <Title level={4} style={{ margin: 0 }}>AJBCC Task Board</Title>
        <Space>
          <Button icon={<InboxOutlined />} onClick={() => setIsArchiveModalVisible(true)}>
            View Archives ({archivedTickets.length})
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            New Ticket
          </Button>
        </Space>
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
              <Tag color="blue" style={{ margin: 0 }}>{activeTickets.filter(t => t.status === column).length}</Tag>
            </div>
            
            <div className="ticket-list">
              {activeTickets.filter(t => t.status === column).map(ticket => (
                <Card
                  key={ticket.id}
                  size="small"
                  className="ticket-card"
                  draggable
                  onDragStart={(e) => onDragStart(e, ticket.id)}
                  title={ticket.task_name}
                  extra={
                    <Space size="small">
                      <Dropdown menu={getMoveMenu(ticket.id)} trigger={['click']}>
                        <Button type="text" icon={<MoreOutlined />} size="small" title="Move Ticket" />
                      </Dropdown>
                      <Button type="text" icon={<EditOutlined />} size="small" onClick={() => openEditModal(ticket)} title="Edit Ticket" />
                      <Popconfirm
                        title="Archive ticket"
                        description="Move this ticket to the archive?"
                        onConfirm={() => handleArchiveToggle(ticket.id, true)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Button type="text" icon={<InboxOutlined />} size="small" title="Archive Ticket" />
                      </Popconfirm>
                    </Space>
                  }
                  style={{ marginBottom: 12, cursor: 'grab' }}
                  styles={{ header: { fontSize: '14px', borderBottom: '1px solid #f0f0f0' } }}
                >
                  {ticket.task_owner && (
                    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, color: '#595959' }}>
                      <UserOutlined />
                      <Text type="secondary" style={{ fontSize: 13 }}>{ticket.task_owner}</Text>
                    </div>
                  )}
                  {ticket.description && (
                    <div style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 6, color: '#595959', fontSize: 13 }}>
                      <AlignLeftOutlined style={{ marginTop: 4 }} />
                      <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{ticket.description}</Text>
                    </div>
                  )}
                  
                  <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px dashed #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      Updated: {formatDate(ticket.updated_at)}
                    </Text>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </Content>

      {/* CREATE / EDIT MODAL */}
      <Modal
        title={editingTicket ? "Edit Ticket" : "Create New Ticket"}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        destroyOnHidden
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

      {/* ARCHIVE MODAL */}
      <Modal
        title="Archived Tickets"
        open={isArchiveModalVisible}
        onCancel={() => setIsArchiveModalVisible(false)}
        footer={null}
        width={600}
        destroyOnHidden
      >
        {archivedTickets.length === 0 ? (
          <Text type="secondary">No archived tickets.</Text>
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={archivedTickets}
            renderItem={ticket => (
              <List.Item
                actions={[
                  <Button key="restore" type="link" icon={<UndoOutlined />} onClick={() => handleArchiveToggle(ticket.id, false)}>Restore</Button>,
                  <Popconfirm
                    key="delete"
                    title="Delete permanently"
                    onConfirm={() => handleDelete(ticket.id)}
                  >
                    <Button type="link" danger icon={<DeleteOutlined />}>Delete</Button>
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta
                  title={ticket.task_name}
                  description={`Status before archiving: ${ticket.status} | Updated: ${formatDate(ticket.updated_at)}`}
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </Layout>
  );
}

export default App;
