import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./views/Dashboard";
import Knowledge from "./views/Knowledge";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="knowledge" element={<Knowledge />} />
      </Route>
    </Routes>
  );
}

export default App;
