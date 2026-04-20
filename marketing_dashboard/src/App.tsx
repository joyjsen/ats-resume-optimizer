import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import ApprovePost from './pages/ApprovePost';
import BrandPlaybook from './pages/BrandPlaybook';
import CalendarView from './pages/CalendarView';
import CustomPost from './pages/CustomPost';
import MediaLibrary from './pages/MediaLibrary';
import AdminRoute from './components/AdminRoute';

function App() {
  return (
    <AdminRoute>
      <BrowserRouter basename="/marketing_dashboard">
        <Routes>
          <Route element={<MainLayout />}>
             <Route path="/" element={<Dashboard />} />
             <Route path="/approve/:id" element={<ApprovePost />} />
             <Route path="/playbook" element={<BrandPlaybook />} />
             <Route path="/calendar" element={<CalendarView />} />
             <Route path="/create" element={<CustomPost />} />
             <Route path="/media" element={<MediaLibrary />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AdminRoute>
  );
}

export default App;
