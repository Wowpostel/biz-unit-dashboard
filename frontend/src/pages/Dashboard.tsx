import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface BusinessUnit {
  id: number;
  name: string;
  turnover: number;
  priority: string;
}

const Dashboard: React.FC = () => {
  const [units, setUnits] = useState<BusinessUnit[]>([]);

  useEffect(() => {
    const fetchUnits = async () => {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/business-units', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUnits(res.data);
    };
    fetchUnits();
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Направления бизнеса</h2>
      {units.map((unit) => (
        <div key={unit.id} style={{ border: '1px solid #ccc', marginBottom: '1rem', padding: '1rem' }}>
          <h3>{unit.name}</h3>
          <p>Оборот: {unit.turnover}</p>
          <p>Приоритет: {unit.priority}</p>
        </div>
      ))}
    </div>
  );
};

export default Dashboard;
