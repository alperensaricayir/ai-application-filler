import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PersistenceProvider } from './context/PersistenceContext';
import GeneratePage from './pages/GeneratePage';
import AdminPage from './pages/AdminPage';

function App() {
  return (
    <PersistenceProvider>
      <Router>
        <Routes>
          <Route path="/" element={<GeneratePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Router>
    </PersistenceProvider>
  );
}

export default App;
