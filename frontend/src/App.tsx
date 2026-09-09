import { useState, useEffect } from 'react';
import { Button, Modal, Form, Input, Card, Layout, Typography, Tag, Popconfirm, message, Space, Dropdown, List, Select } from 'antd';
import type { MenuProps } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, UserOutlined, AlignLeftOutlined, InboxOutlined, ClockCircleOutlined, MoreOutlined, UndoOutlined, LockOutlined } from '@ant-design/icons';
import './App.css';
import type { Ticket, ColumnType } from './types';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

const API_URL = import.meta.env.VITE_API_URL || '/api';
const COLUMNS: ColumnType[] = ['Backlog', 'In Progress', 'Review', 'Done'];

const COLUMN_COLORS: Record<ColumnType, string> = {
  'Backlog': '#f0f5ff',
  'In Progress': '#fffbe6',
  'Review': '#f9f0ff',
  'Done': '#f6ffed'
};

const PRIORITY_COLORS: Record<string, string> = {
  'H': '#ff4d4f',
  'M': '#faad14',
  'L': '#52c41a'
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('board_token'));
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isArchiveModalVisible, setIsArchiveModalVisible] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  
  const [form] = Form.useForm();
  const [loginForm] = Form.useForm();

  // Helper for authenticated requests
  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('board_token');
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
    
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      handleLogout();
      throw new Error("Unauthorized");
    }
    return res;
  };

  const handleLogout = () => {
    localStorage.removeItem('board_token');
    setIsAuthenticated(false);
    setTickets([]);
  };

  const handleLogin = async (values: any) => {
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('board_token', data.token);
        setIsAuthenticated(true);
        message.success("Logged in securely");
      } else {
        message.error("Incorrect password");
      }
    } catch (err) {
      message.error("Login failed");
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTickets();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('board_token');
    const wsUrl = `${protocol}//${window.location.host}/api/ws?token=${token}`;
    
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

      ws.onclose = (event) => {
        console.log('WebSocket disconnected');
        if (event.code === 1008) {
          // Token invalid
          handleLogout();
        } else {
          reconnectInterval = setInterval(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      clearInterval(reconnectInterval);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [isAuthenticated]);

  const fetchTickets = async () => {
    try {
      const res = await authFetch(`${API_URL}/tickets/`);
      const data = await res.json();
      setTickets(data);
    } catch (err) {
      console.error(err);
    }
  };

  const openCreateModal = () => {
    setEditingTicket(null);
    form.resetFields();
    form.setFieldsValue({ priority: 'M' });
    setIsModalVisible(true);
  };

  const openEditModal = (ticket: Ticket) => {
    setEditingTicket(ticket);
    form.setFieldsValue({
      task_name: ticket.task_name,
      task_owner: ticket.task_owner,
      description: ticket.description,
      priority: ticket.priority,
    });
    setIsModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    if (editingTicket) {
      try {
        await authFetch(`${API_URL}/tickets/${editingTicket.id}`, {
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
        await authFetch(`${API_URL}/tickets/`, {
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
      await authFetch(`${API_URL}/tickets/${ticketId}`, {
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
      await authFetch(`${API_URL}/tickets/${ticketId}`, {
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
      await authFetch(`${API_URL}/tickets/${ticketId}`, { method: 'DELETE' });
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
    if (!dateString) return '';
    const utcDateString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
    const d = new Date(utcDateString);
    return d.toLocaleString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isAuthenticated) {
    return (
      <Layout style={{ height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f5f5f5' }}>
        <Card style={{ width: 350, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <LockOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 8 }} />
            <Title level={4} style={{ margin: 0 }}>Secure Board Access</Title>
            <Text type="secondary">Enter the team password to continue</Text>
          </div>
          <Form form={loginForm} onFinish={handleLogin} layout="vertical">
            <Form.Item name="password" rules={[{ required: true, message: 'Password is required' }]}>
              <Input.Password placeholder="Enter Password" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block>
              Unlock Board
            </Button>
          </Form>
        </Card>
      </Layout>
    );
  }

  const activeTickets = tickets.filter(t => !t.is_archived);
  const archivedTickets = tickets.filter(t => t.is_archived);

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
    <Layout style={{ height: '100vh', background: '#f5f5f5' }}>
      <Header style={{ background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', zIndex: 1 }}>
        <Title level={4} style={{ margin: 0, color: '#1890ff' }}>Scrum Board</Title>
        <Space>
          <Button icon={<InboxOutlined />} onClick={() => setIsArchiveModalVisible(true)}>
            Archives ({archivedTickets.length})
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            New Ticket
          </Button>
          <Button type="text" onClick={handleLogout}>Logout</Button>
        </Space>
      </Header>

      <Content className="board-wrapper">
        {COLUMNS.map(column => (
          <div 
            key={column} 
            className="board-column"
            style={{ backgroundColor: COLUMN_COLORS[column], border: `1px solid ${COLUMN_COLORS[column]}`, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, column)}
          >
            <div className="column-header" style={{ borderBottomColor: '#d9d9d9' }}>
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
                  title={
                    <Space align="center" style={{ width: '100%' }}>
                      <Tag color={PRIORITY_COLORS[ticket.priority || 'M']} style={{ margin: 0, borderRadius: '10px' }}>
                        {ticket.priority || 'M'}
                      </Tag>
                      <Text strong style={{ fontSize: 14 }}>{ticket.task_name}</Text>
                    </Space>
                  }
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
                  style={{ marginBottom: 12, cursor: 'grab', borderLeft: `4px solid ${PRIORITY_COLORS[ticket.priority || 'M']}` }}
                  styles={{ header: { borderBottom: '1px solid #f0f0f0', padding: '0 12px' }, body: { padding: '12px' } }}
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
          
          <Space size="large" style={{ display: 'flex', width: '100%' }}>
            <Form.Item name="priority" label="Priority" style={{ width: '120px' }}>
              <Select>
                <Option value="H"><Tag color={PRIORITY_COLORS['H']}>High</Tag></Option>
                <Option value="M"><Tag color={PRIORITY_COLORS['M']}>Medium</Tag></Option>
                <Option value="L"><Tag color={PRIORITY_COLORS['L']}>Low</Tag></Option>
              </Select>
            </Form.Item>
            
            <Form.Item name="task_owner" label="Task Owner" style={{ flex: 1 }}>
              <Input placeholder="E.g., John Doe" />
            </Form.Item>
          </Space>

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
                  title={
                    <Space>
                      <Tag color={PRIORITY_COLORS[ticket.priority || 'M']}>{ticket.priority || 'M'}</Tag>
                      {ticket.task_name}
                    </Space>
                  }
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
