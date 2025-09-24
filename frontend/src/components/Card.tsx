import React from 'react';

interface Props {
  name: string;
  turnover: number;
  priority: string;
}

const Card: React.FC<Props> = ({ name, turnover, priority }) => {
  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem', marginBottom: '1rem' }}>
      <h3>{name}</h3>
      <p>Оборот: {turnover}</p>
      <p>Приоритет: {priority}</p>
    </div>
  );
};

export default Card;
