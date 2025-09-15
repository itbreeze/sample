import React from 'react';

function MockUpECM() {
  const handleEnterClick = () => {
    window.open('/intelligent-tool', '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={styles.container}>
      <h1>Mock-Up ECM</h1>
      <button style={styles.button} onClick={handleEnterClick}>
        입구
      </button>
    </div>
  );
}

export default MockUpECM;

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
  },
  button: {
    padding: '12px 24px',
    fontSize: '18px',
    cursor: 'pointer',
  },
};
