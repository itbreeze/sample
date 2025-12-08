// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './tree-typography.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom'; 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* 👇 App을 BrowserRouter로 감싸줍니다. */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
