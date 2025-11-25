import { Routes, Route } from 'react-router-dom';
import MockUpECM from './pages/MockupEcm';
import EpnidSystemPage from './pages/EpnidSystemPage';
import MainLayout from './layouts/MainLayout';

function App() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<MockUpECM />} />
        <Route path="/ePnidSystem" element={<EpnidSystemPage />} />
      </Routes>
    </MainLayout>
  );
}

export default App;
