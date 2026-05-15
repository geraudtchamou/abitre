import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShieldCheck, 
  Clock, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  MessageSquare,
  Users
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDashboardStats } from '../store/slices/dashboardSlice';

const StatCard = ({ title, value, change, changeType, icon: Icon, color }) => (
  <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all duration-300 group">
    <div className="flex items-start justify-between mb-4">
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-white">{value}</h3>
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} bg-opacity-10`}>
        <Icon size={24} className={color.replace('bg-', 'text-')} />
      </div>
    </div>
    {change && (
      <div className="flex items-center gap-2">
        {changeType === 'positive' ? (
          <TrendingUp size={16} className="text-emerald-400" />
        ) : (
          <TrendingDown size={16} className="text-red-400" />
        )}
        <span className={`text-sm font-medium ${changeType === 'positive' ? 'text-emerald-400' : 'text-red-400'}`}>
          {change}
        </span>
        <span className="text-slate-500 text-sm">vs last month</span>
      </div>
    )}
  </div>
);

const EscrowCard = ({ escrow }) => (
  <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all duration-200">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <FileText size={20} className="text-white" />
        </div>
        <div>
          <h4 className="font-semibold text-white">{escrow.title}</h4>
          <p className="text-xs text-slate-400">{escrow.counterparty}</p>
        </div>
      </div>
      <span className={`px-3 py-1 rounded-full text-xs font-medium
        ${escrow.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : ''}
        ${escrow.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-400' : ''}
        ${escrow.status === 'Disputed' ? 'bg-red-500/10 text-red-400' : ''}
        ${escrow.status === 'Completed' ? 'bg-blue-500/10 text-blue-400' : ''}
      `}>
        {escrow.status}
      </span>
    </div>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-slate-400 mb-1">Amount</p>
        <p className="text-lg font-bold text-white">${escrow.amount.toLocaleString()}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-slate-400 mb-1">Created</p>
        <p className="text-xs text-slate-300">{escrow.createdAt}</p>
      </div>
    </div>
  </div>
);

const TransactionRow = ({ transaction }) => (
  <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
    <td className="py-4 px-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center
          ${transaction.type === 'credit' ? 'bg-emerald-500/10' : 'bg-red-500/10'}
        `}>
          {transaction.type === 'credit' ? (
            <ArrowDownLeft size={20} className="text-emerald-400" />
          ) : (
            <ArrowUpRight size={20} className="text-red-400" />
          )}
        </div>
        <div>
          <p className="font-medium text-white">{transaction.description}</p>
          <p className="text-xs text-slate-400">{transaction.date}</p>
        </div>
      </div>
    </td>
    <td className="py-4 px-4">
      <span className={`px-3 py-1 rounded-full text-xs font-medium
        ${transaction.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : ''}
        ${transaction.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-400' : ''}
        ${transaction.status === 'Failed' ? 'bg-red-500/10 text-red-400' : ''}
      `}>
        {transaction.status}
      </span>
    </td>
    <td className={`py-4 px-4 text-right font-semibold
      ${transaction.type === 'credit' ? 'text-emerald-400' : 'text-white'}
    `}>
      {transaction.type === 'credit' ? '+' : '-'}${transaction.amount.toLocaleString()}
    </td>
  </tr>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { stats, loading, error } = useSelector((state) => state.dashboard);
  const { user } = useSelector((state) => state.auth);

  const [timeRange, setTimeRange] = useState('7d');

  const revenueData = [
    { date: 'Mon', revenue: 4200, expenses: 2100 },
    { date: 'Tue', revenue: 3800, expenses: 1900 },
    { date: 'Wed', revenue: 5100, expenses: 2400 },
    { date: 'Thu', revenue: 4600, expenses: 2200 },
    { date: 'Fri', revenue: 5900, expenses: 2800 },
    { date: 'Sat', revenue: 5200, expenses: 2500 },
    { date: 'Sun', revenue: 6100, expenses: 2900 },
  ];

  const escrowDistribution = [
    { name: 'Active', value: 45, color: '#3b82f6' },
    { name: 'Completed', value: 35, color: '#10b981' },
    { name: 'Pending', value: 15, color: '#f59e0b' },
    { name: 'Disputed', value: 5, color: '#ef4444' },
  ];

  const recentEscrows = [
    {
      id: 1,
      title: 'Website Development Project',
      counterparty: 'John Doe',
      amount: 5000,
      status: 'Active',
      createdAt: '2 hours ago'
    },
    {
      id: 2,
      title: 'Mobile App Design',
      counterparty: 'Sarah Smith',
      amount: 3500,
      status: 'Pending',
      createdAt: '1 day ago'
    },
    {
      id: 3,
      title: 'SEO Optimization',
      counterparty: 'Mike Johnson',
      amount: 1200,
      status: 'Completed',
      createdAt: '3 days ago'
    },
    {
      id: 4,
      title: 'Logo Design',
      counterparty: 'Emily Brown',
      amount: 800,
      status: 'Disputed',
      createdAt: '5 days ago'
    },
  ];

  const recentTransactions = [
    {
      id: 1,
      description: 'Escrow Payment Received',
      date: 'Today, 10:30 AM',
      amount: 5000,
      type: 'credit',
      status: 'Completed'
    },
    {
      id: 2,
      description: 'Withdrawal to Bank',
      date: 'Yesterday, 3:45 PM',
      amount: 2000,
      type: 'debit',
      status: 'Completed'
    },
    {
      id: 3,
      description: 'Escrow Created',
      date: 'Dec 18, 2024',
      amount: 3500,
      type: 'debit',
      status: 'Pending'
    },
    {
      id: 4,
      description: 'Refund Received',
      date: 'Dec 17, 2024',
      amount: 800,
      type: 'credit',
      status: 'Completed'
    },
  ];

  useEffect(() => {
    dispatch(fetchDashboardStats());
  }, [dispatch]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back, {user?.firstName || 'User'}!
            </h1>
            <p className="text-slate-400">Here's what's happening with your account today.</p>
          </div>
          <button 
            onClick={() => navigate('/escrows/new')}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
          >
            <Plus size={20} />
            Create Escrow
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Balance"
          value="$12,450.00"
          change="+12.5%"
          changeType="positive"
          icon={DollarSign}
          color="bg-emerald-500"
        />
        <StatCard
          title="Active Escrows"
          value="24"
          change="+3"
          changeType="positive"
          icon={ShieldCheck}
          color="bg-blue-500"
        />
        <StatCard
          title="Completed Transactions"
          value="156"
          change="+18.2%"
          changeType="positive"
          icon={TrendingUp}
          color="bg-purple-500"
        />
        <StatCard
          title="Disputed Cases"
          value="3"
          change="-2"
          changeType="positive"
          icon={AlertCircle}
          color="bg-red-500"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Revenue Overview</h3>
            <div className="flex gap-2">
              {['7d', '30d', '90d'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${timeRange === range 
                      ? 'bg-blue-600 text-white' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }
                  `}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid #1e293b',
                    borderRadius: '12px'
                  }} 
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpenses)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Escrow Distribution */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">Escrow Status</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={escrowDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {escrowDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid #1e293b',
                    borderRadius: '12px'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-3">
            {escrowDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-300 text-sm">{item.name}</span>
                </div>
                <span className="text-white font-semibold">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Escrows */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Recent Escrows</h3>
            <button 
              onClick={() => navigate('/escrows')}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {recentEscrows.map((escrow) => (
              <EscrowCard key={escrow.id} escrow={escrow} />
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Recent Transactions</h3>
            <button 
              onClick={() => navigate('/wallet')}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium"
            >
              View All
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 text-sm border-b border-slate-800">
                  <th className="pb-4 px-4 font-medium">Description</th>
                  <th className="pb-4 px-4 font-medium">Status</th>
                  <th className="pb-4 px-4 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((transaction) => (
                  <TransactionRow key={transaction.id} transaction={transaction} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
