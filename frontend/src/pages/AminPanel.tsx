import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface User {
  id: number;
  username: string;
  role: string;
}

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data);
    };
    fetchUsers();
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Панель администратора</h2>
      {users.map((user) => (
        <div key={user.id} style={{ borderBottom: '1px solid #ccc', padding: '0.5rem' }}>
          {user.username} — <strong>{user.role}</strong>
        </div>
      ))}
    </div>
  );
};

export default AdminPanel;
