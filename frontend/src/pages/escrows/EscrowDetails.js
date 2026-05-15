import React from 'react';
import { useParams } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';

const EscrowDetails = () => {
  const { id } = useParams();
  
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Escrow Details #{id}</h1>
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 text-center">
          <p className="text-slate-400">Escrow details page - Coming soon</p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EscrowDetails;
