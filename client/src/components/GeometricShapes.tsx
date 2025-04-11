import React from 'react';
import '../styles/components/geometric-shapes.css';

export function GeometricShapes() {
  return (
    <div className="geometric-shapes">
      <div 
        className="shape shape-circle" 
        style={{ 
          top: '10%', 
          left: '5%', 
          '--size': '250px',
          '--duration': '25s',
          '--move-x': '150px',
          '--move-y': '-100px',
          '--move-alt-x': '-200px',
          '--move-alt-y': '150px'
        } as React.CSSProperties}
      />
      
      <div 
        className="shape shape-square" 
        style={{ 
          top: '60%', 
          right: '10%', 
          '--size': '180px',
          '--duration': '30s',
          '--move-x': '-150px',
          '--move-y': '-120px',
          '--move-alt-x': '100px',
          '--move-alt-y': '180px'
        } as React.CSSProperties}
      />
      
      <div 
        className="shape shape-triangle" 
        style={{ 
          bottom: '15%', 
          left: '15%', 
          '--size': '200px',
          '--duration': '35s',
          '--move-x': '120px',
          '--move-y': '-150px',
          '--move-alt-x': '-100px',
          '--move-alt-y': '80px'
        } as React.CSSProperties}
      />
      
      <div 
        className="shape shape-donut" 
        style={{ 
          top: '25%', 
          right: '20%', 
          '--size': '230px',
          '--duration': '40s',
          '--move-x': '-180px',
          '--move-y': '120px',
          '--move-alt-x': '150px',
          '--move-alt-y': '-100px'
        } as React.CSSProperties}
      />
    </div>
  );
} 