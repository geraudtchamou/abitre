import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, FileText, DollarSign, Calendar, User, ChevronRight } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEscrows } from '../../store/slices/escrowSlice';

const EscrowList = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { escrows, pagination, loading } = useSelector((state) => state.escrow);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const statusOptions = [
    { value: 'all', label: 'All Statuses', color: 'bg-slate-500' },
    { value: 'pending', label: 'Pending', color: 'bg-yellow-500' },
    { value: 'active', label: 'Active', color: 'bg-blue-500' },
    { value: 'completed', label: 'Completed', color: 'bg-emerald-500' },
    { value: 'disputed', label: 'Disputed', color: 'bg-red-500' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-slate-500' },
  ];

  useEffect(() => {
    dispatch(fetchEscrows({ status: statusFilter !== 'all' ? statusFilter : null, page: currentPage }));
  }, [dispatch, statusFilter, currentPage]);

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      active: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      disputed: 'bg-red-500/10 text-red-400 border-red-500/20',
      cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      funded: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    };
    return colors[status?.toLowerCase()] || colors.pending;
  };

  const filteredEscrows = escrows.filter((escrow) =>
    escrow.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    escrow.counterparty?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Escrows</h1>
            <p className="text-slate-400">Manage your secure transactions and payments</p>
          </div>
          <button
            onClick={() => navigate('/escrows/new')}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg shadow-blue-500/25"
          >
            <Plus size={20} />
            Create Escrow
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search escrows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            <Filter size={20} className="text-slate-400 flex-shrink-0" />
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setStatusFilter(option.value);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                  ${statusFilter === option.value
                    ? `${option.color.replace('bg-', 'bg-')} text-white`
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Escrow List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredEscrows.length === 0 ? (
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-12 text-center">
          <FileText size={64} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No escrows found</h3>
          <p className="text-slate-400 mb-6">Create your first escrow to get started</p>
          <button
            onClick={() => navigate('/escrows/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Create Escrow
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4">
            {filteredEscrows.map((escrow) => (
              <div
                key={escrow.id}
                onClick={() => navigate(`/escrows/${escrow.id}`)}
                className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <FileText size={24} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                          {escrow.title}
                        </h3>
                        <p className="text-sm text-slate-400 truncate">{escrow.counterparty}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center gap-2">
                        <DollarSign size={16} className="text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-400">Amount</p>
                          <p className="text-sm font-semibold text-white">
                            ${escrow.amount?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-400">Created</p>
                          <p className="text-sm text-white">{new Date(escrow.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-slate-400" />
                        <div>
                          <p className="text-xs text-slate-400">Role</p>
                          <p className="text-sm text-white capitalize">{escrow.role}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-400 transition-colors" />
                        <div>
                          <p className="text-xs text-slate-400">View</p>
                          <p className="text-sm text-blue-400">Details →</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <span className={`px-4 py-2 rounded-full text-xs font-semibold border ${getStatusColor(escrow.status)}`}>
                    {escrow.status}
                  </span>
                </div>

                {escrow.milestones && escrow.milestones.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400">
                        Milestones: {escrow.milestones.filter(m => m.completed).length}/{escrow.milestones.length} completed
                      </p>
                      <div className="flex-1 mx-4">
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
                            style={{ width: `${(escrow.milestones.filter(m => m.completed).length / escrow.milestones.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
              >
                Previous
              </button>
              
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-10 h-10 rounded-lg font-medium transition-colors
                    ${currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))}
                disabled={currentPage === pagination.pages}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
};

export default EscrowList;
