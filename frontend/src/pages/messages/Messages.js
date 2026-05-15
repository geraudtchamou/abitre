import React from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';

const Messages = () => {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Messages</h1>
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 text-center">
          <p className="text-slate-400">Real-time messaging with Socket.IO - Coming soon</p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Messages;
