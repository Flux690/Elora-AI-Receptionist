import { useState, useEffect, useCallback } from 'react';
import { getPendingRequests, getUnresolvedRequests } from '../services/apiClient';
import RequestList from '../components/RequestList';

function Dashboard() {
  const [pending, setPending] = useState([]);
  const [unresolved, setUnresolved] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const pendingRes = await getPendingRequests();
      setPending(pendingRes.data);
      const unresolvedRes = await getUnresolvedRequests();
      setUnresolved(unresolvedRes.data);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResolve = () => {
    fetchData();
  };

  return (
    <section aria-labelledby="dashboard-title">
      <h1 id="dashboard-title" className="page-title">
        Supervisor Dashboard
      </h1>
      <div className="dashboard-container">
        <RequestList
          title="Pending Requests"
          requests={pending}
          onResolve={handleResolve}
          listType="pending"
        />
        <RequestList
          title="Unresolved Requests"
          requests={unresolved}
          onResolve={handleResolve}
          listType="unresolved"
        />
      </div>
    </section>
  );
}

export default Dashboard;