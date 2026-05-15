import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Upload, DollarSign, Users, Calendar, FileText, Shield, Info } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';

const CreateEscrow = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    buyerEmail: '',
    sellerEmail: '',
    amount: '',
    currency: 'USD',
    escrowType: 'milestone',
    milestones: [{ title: '', amount: '', dueDate: '' }],
    contractTerms: '',
    attachments: [],
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMilestoneChange = (index, field, value) => {
    const updatedMilestones = [...formData.milestones];
    updatedMilestones[index][field] = value;
    setFormData((prev) => ({ ...prev, milestones: updatedMilestones }));
  };

  const addMilestone = () => {
    setFormData((prev) => ({
      ...prev,
      milestones: [...prev.milestones, { title: '', amount: '', dueDate: '' }],
    }));
  };

  const removeMilestone = (index) => {
    if (formData.milestones.length > 1) {
      const updatedMilestones = formData.milestones.filter((_, i) => i !== index);
      setFormData((prev) => ({ ...prev, milestones: updatedMilestones }));
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setFormData((prev) => ({ ...prev, attachments: [...prev.attachments, ...files] }));
  };

  const removeAttachment = (index) => {
    const updatedAttachments = formData.attachments.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, attachments: updatedAttachments }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // TODO: Implement API call to create escrow
    console.log('Creating escrow:', formData);
    navigate('/escrows');
  };

  const totalAmount = formData.milestones.reduce(
    (sum, m) => sum + (parseFloat(m.amount) || 0),
    0
  );

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Create New Escrow</h1>
              <p className="text-slate-400">Set up a secure transaction with milestone payments</p>
            </div>
            <button
              onClick={() => navigate('/escrows')}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {['Transaction Details', 'Parties & Amount', 'Milestones', 'Contract & Review'].map(
              (label, index) => (
                <div key={label} className="flex items-center">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all
                      ${
                        step > index + 1
                          ? 'bg-emerald-500 text-white'
                          : step === index + 1
                          ? 'bg-blue-600 text-white ring-4 ring-blue-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {step > index + 1 ? '✓' : index + 1}
                    </div>
                    <span
                      className={`hidden sm:block text-sm font-medium ${
                        step === index + 1 ? 'text-white' : 'text-slate-400'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {index < 3 && (
                    <div
                      className={`w-12 sm:w-24 h-1 mx-4 rounded ${
                        step > index + 1 ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}
                    />
                  )}
                </div>
              )
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
          {/* Step 1: Transaction Details */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white mb-6">Transaction Details</h2>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Transaction Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Website Development Project"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe the transaction details, deliverables, and expectations..."
                  rows={5}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Escrow Type *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {
                      value: 'milestone',
                      label: 'Milestone-based',
                      desc: 'Split payment into multiple milestones',
                      icon: Calendar,
                    },
                    {
                      value: 'single',
                      label: 'Single Payment',
                      desc: 'One-time payment upon completion',
                      icon: DollarSign,
                    },
                  ].map((type) => (
                    <div
                      key={type.value}
                      onClick={() => setFormData((prev) => ({ ...prev, escrowType: type.value }))}
                      className={`cursor-pointer p-4 rounded-xl border-2 transition-all
                        ${
                          formData.escrowType === type.value
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                        }`}
                    >
                      <type.icon
                        size={24}
                        className={`mb-3 ${
                          formData.escrowType === type.value ? 'text-blue-400' : 'text-slate-400'
                        }`}
                      />
                      <h3 className="font-semibold text-white mb-1">{type.label}</h3>
                      <p className="text-xs text-slate-400">{type.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Parties & Amount */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white mb-6">Parties & Amount</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Buyer Email *
                  </label>
                  <input
                    type="email"
                    name="buyerEmail"
                    value={formData.buyerEmail}
                    onChange={handleInputChange}
                    placeholder="buyer@example.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Seller Email *
                  </label>
                  <input
                    type="email"
                    name="sellerEmail"
                    value={formData.sellerEmail}
                    onChange={handleInputChange}
                    placeholder="seller@example.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
              </div>

              {formData.escrowType === 'single' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Total Amount *
                    </label>
                    <div className="relative">
                      <DollarSign
                        size={20}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="number"
                        name="amount"
                        value={formData.amount}
                        onChange={handleInputChange}
                        placeholder="0.00"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Currency *
                    </label>
                    <select
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="XAF">XAF - Central African CFA</option>
                      <option value="BTC">BTC - Bitcoin</option>
                      <option value="ETH">ETH - Ethereum</option>
                      <option value="USDT">USDT - Tether</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Info size={20} className="text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-400 mb-1">Invitation Notice</h4>
                    <p className="text-sm text-slate-300">
                      Both parties will receive email invitations to review and accept the escrow
                      terms before funds are locked.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-slate-400 hover:text-white px-6 py-3 font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Milestones */}
          {step === 3 && formData.escrowType === 'milestone' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Payment Milestones</h2>
                <button
                  type="button"
                  onClick={addMilestone}
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium"
                >
                  <Upload size={18} />
                  Add Milestone
                </button>
              </div>

              <div className="space-y-4">
                {formData.milestones.map((milestone, index) => (
                  <div
                    key={index}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-white">Milestone {index + 1}</h3>
                      {formData.milestones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMilestone(index)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={milestone.title}
                          onChange={(e) =>
                            handleMilestoneChange(index, 'title', e.target.value)
                          }
                          placeholder="e.g., Initial Design Approval"
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Amount
                        </label>
                        <input
                          type="number"
                          value={milestone.amount}
                          onChange={(e) =>
                            handleMilestoneChange(index, 'amount', e.target.value)
                          }
                          placeholder="0.00"
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={milestone.dueDate}
                        onChange={(e) =>
                          handleMilestoneChange(index, 'dueDate', e.target.value)
                        }
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {totalAmount > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-medium">Total Amount:</span>
                    <span className="text-2xl font-bold text-emerald-400">
                      ${totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-slate-400 hover:text-white px-6 py-3 font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Contract & Review */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white mb-6">Contract & Review</h2>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Contract Terms & Conditions
                </label>
                <textarea
                  name="contractTerms"
                  value={formData.contractTerms}
                  onChange={handleInputChange}
                  placeholder="Enter specific terms, conditions, and legal agreements..."
                  rows={8}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors resize-none font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Attachments (Optional)
                </label>
                <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:border-slate-600 transition-colors">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload size={48} className="mx-auto text-slate-400 mb-4" />
                    <p className="text-white font-medium mb-1">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-slate-400">
                      PDF, DOC, DOCX, PNG, JPG (Max 10MB each)
                    </p>
                  </label>
                </div>

                {formData.attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {formData.attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <FileText size={20} className="text-blue-400" />
                          <span className="text-sm text-white truncate max-w-xs">
                            {file.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h3 className="font-bold text-white mb-4">Transaction Summary</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Transaction Title</span>
                    <span className="text-white">{formData.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Buyer</span>
                    <span className="text-white">{formData.buyerEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Seller</span>
                    <span className="text-white">{formData.sellerEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Escrow Type</span>
                    <span className="text-white capitalize">{formData.escrowType}</span>
                  </div>
                  {formData.escrowType === 'single' && (
                    <div className="flex justify-between pt-3 border-t border-slate-700">
                      <span className="text-slate-400">Total Amount</span>
                      <span className="text-xl font-bold text-emerald-400">
                        ${parseFloat(formData.amount || 0).toLocaleString()} {formData.currency}
                      </span>
                    </div>
                  )}
                  {formData.escrowType === 'milestone' && (
                    <div className="flex justify-between pt-3 border-t border-slate-700">
                      <span className="text-slate-400">Total Amount</span>
                      <span className="text-xl font-bold text-emerald-400">
                        ${totalAmount.toLocaleString()} {formData.currency}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Shield size={20} className="text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-400 mb-1">Security Notice</h4>
                    <p className="text-sm text-slate-300">
                      This transaction is protected by our escrow service. Funds will be held
                      securely until all conditions are met. Platform fee: 2.5%
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-slate-400 hover:text-white px-6 py-3 font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/25"
                >
                  Create Escrow
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </DashboardLayout>
  );
};

export default CreateEscrow;
