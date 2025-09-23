import { Routes, Route } from 'react-router-dom';
import MockUpECM from './components/MockUpECM';
import IntelligentToolPage from './components/IntelligentToolPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MockUpECM />} />
      <Route path="/intelligent-tool" element={<IntelligentToolPage />} />
    </Routes>
  );
}

export default App;