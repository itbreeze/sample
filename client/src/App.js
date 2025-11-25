import { Routes, Route } from 'react-router-dom';
import MockUpECM from './pages/MockupEcm';
import EpnidSystemPage from './pages/EpnidSystemPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MockUpECM />} />
      <Route path="/ePnidSystem" element={<EpnidSystemPage />} />
    </Routes>
  );
}

export default App;
