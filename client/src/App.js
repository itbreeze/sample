import { Routes, Route } from 'react-router-dom';
import MockUpECM from './components/MockUpECM';
import IntelligentTool from './components/IntelligentTool';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MockUpECM />} />
      <Route path="/intelligent-tool" element={<IntelligentTool />} />
    </Routes>
  );
}

export default App;