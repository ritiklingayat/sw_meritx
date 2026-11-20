import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Target,
  Trophy,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  CalendarDays,
  Clock3,
  Wallet,
  LifeBuoy,
  BookOpen,
  GraduationCap,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User,
  Settings,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Send,
  Building,
  Smartphone,
  Check,
  X,
  Play,
  BarChart3,
  Timer,
} from "lucide-react";
import { Shell, Stat, Empty, Loading } from "../../components/Layouts";
import { useAuth } from "../../context/AuthContext";
import { api, money, friendlyDate } from "../../lib/api";
import QuestionRenderer from "../../components/QuestionRenderer";
import {
  getExamScheduleInfo,
  formatDateTime,
  formatDate,
  formatTime,
  formatExamWindow,
  formatCountdown,
} from "../../services/schedulingService";
import { ExamCard } from "../public/Exams";
import "../public/Exams.css";
import "./Student.css";

export function useStudent() {
  const { token } = useAuth();
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const refresh = () =>
    api("/me/dashboard", { token })
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
  }, [token]);
  return { data, error, refresh, token };
}

export function useWallet() {
  const { token } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    return api("/me/wallet", { token })
      .then((data) => {
        const baseWallet = data.wallet || {};
        const w = {
          ...data,
          ...baseWallet,
          balance: baseWallet.balance ?? data.balance ?? 0,
          availableBalance: baseWallet.availableBalance ?? data.availableBalance ?? 0,
          totalDeposited: data.totalDeposited ?? data.totalCredits ?? baseWallet.totalDeposited ?? 0,
          totalSpent: data.totalSpent ?? data.totalDebits ?? baseWallet.totalSpent ?? 0,
          transactions: data.transactions || baseWallet.transactions || []
        };
        setWallet(w);
        setError("");
        return w;
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) refresh();
  }, [token]);

  return { wallet, error, loading, refresh, token };
}

export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      return resolve(true);
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/* ==========================================================================
   Add Money Modal (Razorpay Gateway & Demo Top-Up Flow)
   ========================================================================== */
export function AddMoneyModal({ isOpen, onClose, onMoneyAdded, currentBalance = 0, initialAmount = 500 }) {
  const { token, user } = useAuth();
  const [amount, setAmount] = useState(() => Math.min(1000, Math.max(1, Number(initialAmount) || 500)));
  const [method, setMethod] = useState("UPI / Razorpay");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  if (!isOpen) return null;

  async function handleTopUp(e) {
    if (e) e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 1 || numAmount > 1000) {
      setError("Recharge amount must be between ₹1 and ₹1,000.");
      return;
    }
    setBusy(true);
    setError("");

    try {
      // 1. Create deposit order
      const orderRes = await api("/me/wallet/deposit/order", {
        method: "POST",
        token,
        body: { amount: Number(amount) }
      });

      // 2. Load Razorpay script
      const sdkReady = await loadRazorpayScript();

      // If Razorpay SDK is ready and keyId is configured
      if (sdkReady && window.Razorpay && orderRes.keyId && !orderRes.keyId.includes("demo")) {
        const options = {
          key: orderRes.keyId,
          amount: orderRes.amountPaise || Math.round(Number(amount) * 100),
          currency: "INR",
          name: "SW MERITX",
          description: "Student Wallet Recharge",
          order_id: orderRes.orderId && !orderRes.orderId.includes("test") ? orderRes.orderId : undefined,
          prefill: {
            name: user?.name || "Student",
            email: user?.email || "",
            contact: user?.phone || ""
          },
          theme: {
            color: "#2563eb"
          },
          handler: async function (response) {
            setBusy(true);
            try {
              const verifyRes = await api("/me/wallet/deposit/verify", {
                method: "POST",
                token,
                body: {
                  amount: Number(amount),
                  orderId: response.razorpay_order_id || orderRes.orderId,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                  method: "Razorpay Payment Gateway"
                }
              });
              setSuccess(verifyRes);
              if (onMoneyAdded) onMoneyAdded(verifyRes.newBalance);
              setTimeout(() => {
                onClose();
                setSuccess(null);
              }, 1200);
            } catch (err) {
              setError(err.message || "Payment verification failed.");
            } finally {
              setBusy(false);
            }
          },
          modal: {
            ondismiss: function () {
              setBusy(false);
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", function (response) {
          setError(response.error?.description || "Payment was cancelled or failed.");
          setBusy(false);
        });
        rzp.open();
        return;
      }

      // Fast test/demo recharge fallback
      const res = await api("/me/wallet/deposit/verify", {
        method: "POST",
        token,
        body: {
          amount: Number(amount),
          orderId: orderRes.orderId,
          paymentId: `pay_test_${Date.now()}`,
          signature: "demo_sig_verified",
          method: "Instant Wallet Recharge (UPI/Demo)"
        }
      });
      setSuccess(res);
      if (onMoneyAdded) onMoneyAdded(res.newBalance || (currentBalance + Number(amount)));
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 1200);
    } catch (err) {
      setError(err.message || "Failed to add money. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="checkout-modal-backdrop" onClick={onClose}>
      <div className="checkout-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="checkout-modal-header">
          <div>
            <span className="demo-pill">DEMO WALLET RECHARGE</span>
            <h3>Add Money to Wallet</h3>
          </div>
          <button className="btn-icon-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="checkout-success-view" style={{ padding: "30px 20px" }}>
            <div className="checkout-success-icon">
              <CheckCircle2 size={44} color="#10b981" />
            </div>
            <h4>Recharge Successful!</h4>
            <p className="muted">
              {money(amount)} has been credited instantly to your wallet.
            </p>
          </div>
        ) : (
          <form onSubmit={handleTopUp} style={{ padding: "20px 24px" }}>
            <div style={{ marginBottom: 18, background: "#f8fafc", padding: "12px 16px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Current Available Balance</div>
              <strong style={{ fontSize: 20, color: "#0f172a" }}>{money(currentBalance)}</strong>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                Select Top-Up Amount (₹)
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {[50, 100, 200, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={`btn ${amount === amt ? "btn-primary" : "btn-outline"} small`}
                    onClick={() => setAmount(amt)}
                    style={{ padding: "6px 14px", fontWeight: 700 }}
                  >
                    +{money(amt)}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="1000"
                step="1"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                style={{ width: "100%", padding: "10px 14px", fontSize: 15, fontWeight: 700, borderRadius: 10, border: "1px solid #cbd5e1" }}
                placeholder="Enter amount between ₹1 and ₹1,000..."
                required
              />
              <small style={{ display: "block", color: "#64748b", marginTop: 4, fontSize: 12 }}>Allowed range: ₹1 to ₹1,000</small>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                Simulated Payment Mode
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #cbd5e1" }}
              >
                <option value="UPI Demo Instant">⚡ Instant UPI / QR (Demo)</option>
                <option value="NetBanking Simulation">🏦 Net Banking Simulation</option>
                <option value="Debit Card Mock">💳 Debit / Credit Card Simulation</option>
              </select>
            </div>

            {error && (
              <div className="alert error" style={{ marginBottom: 16 }}>
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy || !amount || Number(amount) < 1 || Number(amount) > 1000}>
                {busy ? "Processing..." : `Deposit ${money(amount)} Now`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   Withdraw Money Modal (Simulated Demo Payout Flow)
   ========================================================================== */
export function WithdrawMoneyModal({ isOpen, onClose, onWithdrawn, currentBalance = 0 }) {
  const { token, user } = useAuth();
  const [amount, setAmount] = useState(Math.min(500, Math.max(10, currentBalance || 500)));
  const [payoutMethod, setPayoutMethod] = useState("upi");
  const [upiId, setUpiId] = useState("");
  const [bankAccount, setBankAccount] = useState({
    accountNumber: "",
    ifsc: "",
    holderName: user?.name || "Candidate",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  if (!isOpen) return null;

  async function handleWithdraw(e) {
    if (e) e.preventDefault();
    if (amount <= 0) {
      setError("Please enter a valid withdrawal amount.");
      return;
    }
    if (amount > currentBalance) {
      setError(`Cannot withdraw more than available balance (${money(currentBalance)}).`);
      return;
    }

    if (payoutMethod === "upi" && (!upiId || !upiId.includes("@"))) {
      setError("Please enter a valid UPI ID (e.g., student@okhdfcbank).");
      return;
    }

    if (payoutMethod === "bank" && (!bankAccount.accountNumber || !bankAccount.ifsc)) {
      setError("Please enter valid bank account number and IFSC code.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const res = await api("/me/wallet/withdraw", {
        method: "POST",
        token,
        body: {
          amount: Number(amount),
          payoutMethod,
          destinationDetails: payoutMethod === "upi" ? { upiId } : bankAccount,
        },
      });

      if (!res.success) {
        setError(res.message || "Withdrawal failed.");
        setBusy(false);
        return;
      }

      setSuccess(res);
      if (onWithdrawn) onWithdrawn(res.newBalance);
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 1400);
    } catch (err) {
      setError(err.message || "Withdrawal request failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="checkout-modal-backdrop" onClick={onClose}>
      <div className="checkout-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="checkout-modal-header">
          <div>
            <span className="demo-pill" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#059669" }}>
              DEMO PAYOUT TRANSFER
            </span>
            <h3>Withdraw Money</h3>
          </div>
          <button className="btn-icon-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="checkout-success-view" style={{ padding: "30px 20px" }}>
            <div className="checkout-success-icon">
              <CheckCircle2 size={44} color="#10b981" />
            </div>
            <h4>Withdrawal Processed!</h4>
            <p className="muted">
              {money(amount)} has been transferred and deducted from your student wallet.
            </p>
          </div>
        ) : (
          <form onSubmit={handleWithdraw} style={{ padding: "20px 24px" }}>
            <div style={{ marginBottom: 18, background: "#f8fafc", padding: "12px 16px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Available to Withdraw</div>
              <strong style={{ fontSize: 20, color: "#0f172a" }}>{money(currentBalance)}</strong>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                Withdrawal Amount (₹)
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {[200, 500, 1000, 1500].filter(amt => amt <= currentBalance).map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={`btn ${amount === amt ? "btn-primary" : "btn-outline"} small`}
                    onClick={() => setAmount(amt)}
                    style={{ padding: "6px 14px", fontWeight: 700 }}
                  >
                    {money(amt)}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="10"
                max={currentBalance}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                style={{ width: "100%", padding: "10px 14px", fontSize: 15, fontWeight: 700, borderRadius: 10, border: "1px solid #cbd5e1" }}
                placeholder="Enter amount to withdraw..."
                required
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                Payout Destination
              </label>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <button
                  type="button"
                  className={`btn ${payoutMethod === "upi" ? "btn-primary" : "btn-outline"} small`}
                  onClick={() => setPayoutMethod("upi")}
                  style={{ flex: 1, padding: "8px 12px" }}
                >
                  ⚡ Instant UPI / QR
                </button>
                <button
                  type="button"
                  className={`btn ${payoutMethod === "bank" ? "btn-primary" : "btn-outline"} small`}
                  onClick={() => setPayoutMethod("bank")}
                  style={{ flex: 1, padding: "8px 12px" }}
                >
                  🏦 Bank Transfer
                </button>
              </div>

              {payoutMethod === "upi" ? (
                <div>
                  <input
                    type="text"
                    placeholder="Enter UPI ID (e.g. mobile@upi, name@okhdfcbank)"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #cbd5e1" }}
                    required
                  />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    type="text"
                    placeholder="Bank Account Number"
                    value={bankAccount.accountNumber}
                    onChange={(e) => setBankAccount({ ...bankAccount, accountNumber: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #cbd5e1" }}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Bank IFSC Code (e.g. HDFC0001234)"
                    value={bankAccount.ifsc}
                    onChange={(e) => setBankAccount({ ...bankAccount, ifsc: e.target.value.toUpperCase() })}
                    style={{ width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #cbd5e1" }}
                    required
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="alert error" style={{ marginBottom: 16 }}>
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy || amount <= 0 || amount > currentBalance}>
                {busy ? "Processing Payout..." : `Withdraw ${money(amount)} Now`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   Exam Registration & Wallet Deduction Modal
   ========================================================================== */
export function ExamRegistrationModal({ exam, wallet, onClose, onRegistered, onAddMoney }) {
  const { token, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [agreed, setAgreed] = useState(true);

  if (!exam) return null;

  const price = Number(exam.fee ?? 0);
  const availableBalance = Number(wallet?.availableBalance ?? wallet?.balance ?? 0);
  const hasSufficient = availableBalance >= price;
  const shortfall = Math.max(0, price - availableBalance);
  const remaining = Math.max(0, availableBalance - price);

  async function handleRegister() {
    if (!agreed) {
      setError("Please accept the examination rules to proceed.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api("/exams/register", {
        method: "POST",
        token,
        body: { examId: exam.id },
      });

      if (!res.success) {
        if (res.error === "INSUFFICIENT_BALANCE") {
          setError(`Insufficient Wallet Balance. Required: ₹${res.required}, Available: ₹${res.balance}. Please recharge your wallet.`);
        } else {
          setError(res.message || "Registration failed.");
        }
        setBusy(false);
        return;
      }

      setSuccess(res);
      if (onRegistered) onRegistered(res);
    } catch (err) {
      setError(err.message || "Registration failed. Please check your balance.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="checkout-modal-backdrop" onClick={onClose}>
      <div className="checkout-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="checkout-modal-header">
          <div>
            <span className="demo-pill">EXAM REGISTRATION · WALLET PAYMENT</span>
            <h3>Confirm Exam Registration</h3>
          </div>
          <button className="btn-icon-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="checkout-success-view">
            <div className="checkout-success-icon">
              <CheckCircle2 size={48} color="#10b981" />
            </div>
            <h4>Registration Confirmed!</h4>
            <p className="muted">
              You are now registered for <strong>{exam.title}</strong>.{" "}
              {price > 0 ? (
                <>The registration fee of <strong>{money(price)}</strong> has been deducted from your student wallet.</>
              ) : (
                <>Your complimentary registration has been confirmed.</>
              )}
            </p>
            <div className="checkout-breakdown" style={{ marginTop: 16 }}>
              <div className="breakdown-row">
                <span>Registration ID</span>
                <code>{success.registration?.id || success.registration?.registrationId || "reg-confirmed"}</code>
              </div>
              <div className="breakdown-row">
                <span>Updated Wallet Balance</span>
                <strong style={{ color: "#10b981" }}>{money(success.newBalance ?? remaining)}</strong>
              </div>
            </div>
            <div className="checkout-modal-actions" style={{ marginTop: 24, display: "flex", gap: 12 }}>
              <Link
                to={`/take/${exam.id}`}
                className="btn btn-primary"
                onClick={onClose}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <Play size={15} fill="currentColor" /> Start Examination
              </Link>
              <Link to="/student/exams" className="btn btn-outline" onClick={onClose}>
                Go to My Exams
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="checkout-course-summary">
              <div className="checkout-course-details">
                <h4>{exam.title}</h4>
                <p className="muted">{exam.subject || exam.description || "Standard Competitive Mock Examination"}</p>
                <div className="checkout-meta-tags">
                  <span>Pattern: {exam.type || "Official Pattern"}</span>
                  <span>Duration: {exam.duration || 180} Mins</span>
                  <span>Questions: {exam.questions || 75} Questions</span>
                  <span>Total Marks: {exam.marks || 300} Marks</span>
                </div>
              </div>
            </div>

            <div className="checkout-breakdown">
              <div className="breakdown-row">
                <span>Registration Fee</span>
                <strong style={{ color: price > 0 ? "#0f172a" : "#10b981" }}>
                  {price > 0 ? money(price) : "FREE"}
                </strong>
              </div>
              <div className="breakdown-row">
                <span>Your Current Wallet Balance</span>
                <strong style={{ color: hasSufficient ? "#10b981" : "#ef4444" }}>
                  {money(availableBalance)}
                </strong>
              </div>
              <div className="breakdown-divider" />
              {hasSufficient ? (
                <div className="breakdown-row">
                  <span>Balance After Deduction</span>
                  <strong style={{ color: "#2563eb", fontSize: 16 }}>{money(remaining)}</strong>
                </div>
              ) : (
                <div className="breakdown-row shortfall-row">
                  <span style={{ color: "#ef4444", fontWeight: 700 }}>Shortfall Needed</span>
                  <strong style={{ color: "#ef4444", fontSize: 16 }}>{money(shortfall)}</strong>
                </div>
              )}
            </div>

            {!hasSufficient && (
              <div className="checkout-shortfall-alert">
                <AlertCircle size={20} color="#ef4444" />
                <div>
                  <strong>Insufficient Wallet Balance</strong>
                  <p>You need an additional {money(shortfall)} in your wallet to register for this examination.</p>
                </div>
              </div>
            )}

            <div style={{ padding: "10px 24px 0" }}>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12, color: "#64748b", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  I understand that single attempt limits apply. The registration fee is deducted directly from my wallet balance.
                </span>
              </label>
            </div>

            {error && (
              <div className="alert error" style={{ margin: "14px 24px 0" }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div className="checkout-modal-actions">
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Cancel
              </button>
              {hasSufficient ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !agreed}
                  onClick={handleRegister}
                  style={{ fontWeight: 800 }}
                >
                  {busy ? "Confirming Registration..." : price > 0 ? `Confirm & Pay ${money(price)}` : "Confirm Free Registration"}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    onClose();
                    if (onAddMoney) onAddMoney(shortfall);
                  }}
                  style={{ fontWeight: 800 }}
                >
                  <Plus size={16} /> Add {money(shortfall)} to Wallet
                </button>
              )}
            </div>
            <p className="checkout-safe-note">
              <ShieldCheck size={14} /> Row-level locking & atomic wallet deduction prevent duplicate charges.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export const CourseCheckoutModal = ExamRegistrationModal;

/* ==========================================================================
   Section 1: Student Dashboard Overview
   ========================================================================== */
export function StudentDashboard() {
  const { user } = useAuth();
  const { data, error: studentError, refresh: refreshStudent } = useStudent();
  const { wallet, refresh: refreshWallet } = useWallet();
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const { token } = useAuth();

  if (!data) {
    return (
      <Shell title="Student Dashboard">
        {studentError ? <div className="alert error">{studentError}</div> : <Loading />}
      </Shell>
    );
  }

  const registeredExams = data.registeredExams || [];
  const attempts = data.attempts?.filter((a) => (a.status === "submitted" || a.status === "TERMINATED") && a.result) || [];
  const acc = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + (a.result?.accuracy || 0), 0) / attempts.length)
    : 0;

  const currentWallet = wallet || data.wallet || { availableBalance: 0, balance: 0, transactions: [] };
  const recentTransactions = (currentWallet.transactions || []).slice(0, 5);

  return (
    <Shell
      title={`Welcome back, ${user.name.split(" ")[0]} 👋`}
      kicker="STUDENT EXAMINATION HUB"
      description="Track your registered examinations, results, accuracy, and national rankings."
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/student/leaderboard" className="btn btn-primary small">
            <Trophy size={15} /> Merit Leaderboards
          </Link>
          <Link to="/student/available" className="btn btn-outline small">
            Available Exams <ArrowUpRight size={15} />
          </Link>
        </div>
      }
    >
      {/* Prominent Wallet Hero Card */}
      <div className="wallet-hero-card">
        <div className="wallet-hero-main">
          <span className="demo-pill">DEMO MODE · SIMULATED INR</span>
          <div className="wallet-hero-label">Available Wallet Balance</div>
          <div className="wallet-hero-balance">
            {money(currentWallet.availableBalance ?? 0)}
          </div>
          <p className="wallet-hero-sub">
            Individual student wallet · Used for competitive mock examination registrations and prizes.
          </p>
        </div>
        <div className="wallet-hero-actions">
          <button className="btn btn-white" onClick={() => setShowAddMoney(true)}>
            <Plus size={16} /> Add Money
          </button>
          <button className="btn btn-glass" onClick={() => setShowWithdraw(true)}>
            <ArrowUpRight size={16} /> Withdraw
          </button>
          <Link to="/student/available" className="btn btn-glass">
            <ArrowUpRight size={16} /> Register Exam
          </Link>
          <Link to="/student/wallet" className="btn btn-glass">
            <Wallet size={16} /> View Ledger
          </Link>
        </div>
      </div>

      {/* 4 Key Metric Cards */}
      <div className="grid-4" style={{ marginTop: 20 }}>
        <Stat
          icon={Wallet}
          label="Available Balance"
          value={money(currentWallet.availableBalance ?? 0)}
          tone="green"
          delta="Ready for registrations"
        />
        <Stat
          icon={ClipboardList}
          label="Registered Exams"
          value={registeredExams.length}
          tone="purple"
          delta="Enrolled mock assessments"
        />
        <Stat
          icon={Trophy}
          label="Tests Completed"
          value={attempts.length}
          tone="cyan"
          delta="Evaluated attempts"
        />
        <Stat
          icon={Target}
          label="Average Accuracy"
          value={`${acc}%`}
          tone="default"
          delta={attempts.length ? "Across evaluated tests" : "Awaiting first test"}
        />
      </div>

      {/* 2-Column Panels: Registered Exams & Recent Transactions */}
      <div className="grid-2 student-panels">
        {/* Registered Examinations */}
        <section className="panel">
          <div className="panel-head">
            <h3>My Registered Examinations</h3>
            <Link className="action-link" to="/student/exams">
              View all ({registeredExams.length}) <ArrowUpRight size={14} />
            </Link>
          </div>
          {registeredExams.length ? (
            registeredExams.slice(0, 4).map((ex) => {
              const myAtt = attempts.find((a) => a.examId === ex.id);
              const inProg = data.attempts?.find((a) => a.examId === ex.id && a.status === "in_progress");
              const isDone = Boolean(myAtt && (myAtt.status === "submitted" || myAtt.status === "TERMINATED"));

              return (
                <div className="dashboard-exam" key={ex.id}>
                  <div className="mini-exam-icon">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <strong>{ex.title}</strong>
                    <small>
                      {ex.duration || 180} Mins · {ex.questions || 75} Questions · {ex.marks || 300} Marks
                    </small>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {isDone ? (
                      <>
                        <Link className="btn btn-soft small" to={`/student/leaderboard?examId=${ex.id}`}>
                          <Trophy size={13} /> Rank
                        </Link>
                        <Link className="btn btn-outline small" to="/student/results">
                          Score: {myAtt.result?.score}/{ex.marks}
                        </Link>
                      </>
                    ) : inProg ? (
                      <Link className="btn btn-primary small" to={`/take/${ex.id}`}>
                        <Play size={13} fill="currentColor" /> Resume Exam
                      </Link>
                    ) : (
                      <Link className="btn btn-primary small" to={`/take/${ex.id}`}>
                        <Play size={13} fill="currentColor" /> Start Exam
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: "20px 0" }}>
              <Empty
                title="No registered examinations yet"
                text="Browse our published catalog to register for competitive mock examinations."
              />
              <div style={{ textAlign: "center", marginTop: 12, display: "flex", gap: 10, justifyContent: "center" }}>
                <Link to="/student/available" className="btn btn-primary small">
                  Browse Available Exams
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Recent Transactions */}
        <section className="panel">
          <div className="panel-head">
            <h3>Recent Wallet Transactions</h3>
            <Link className="action-link" to="/student/transactions">
              Full ledger <ArrowUpRight size={14} />
            </Link>
          </div>
          {recentTransactions.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <span className="capitalize" style={{ fontWeight: 600 }}>
                          {tx.type?.replace("_", " ")}
                        </span>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>
                          {new Date(tx.createdAt).toLocaleDateString("en-IN")}
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {tx.description || tx.referenceNumber}
                      </td>
                      <td
                        style={{
                          fontWeight: 700,
                          color: tx.type === "deposit" || tx.type === "refund" ? "#10b981" : "#ef4444",
                        }}
                      >
                        {tx.type === "deposit" || tx.type === "refund" ? "+" : "-"}
                        {money(tx.amount)}
                      </td>
                      <td>
                        <span
                          className={`tag ${
                            tx.status === "successful" || tx.status === "completed"
                              ? "green"
                              : tx.status === "pending"
                              ? "orange"
                              : "red"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No transactions yet"
              text="Your wallet ledger is currently empty. Add money to get started."
            />
          )}
        </section>
      </div>

      {/* Top-up modal */}
      {showAddMoney && (
        <AddMoneyModal
          isOpen={showAddMoney}
          onClose={() => setShowAddMoney(false)}
          currentBalance={currentWallet.availableBalance ?? 0}
          onMoneyAdded={() => {
            refreshWallet();
            refreshStudent();
          }}
        />
      )}

      {/* Withdraw modal */}
      {showWithdraw && (
        <WithdrawMoneyModal
          isOpen={showWithdraw}
          onClose={() => setShowWithdraw(false)}
          currentBalance={currentWallet.availableBalance ?? currentWallet.balance ?? 0}
          onWithdrawn={() => {
            refreshWallet();
            refreshStudent();
          }}
        />
      )}

      {/* Motivational Banner */}
      <div className="student-banner">
        <div>
          <span>LEVEL UP YOUR EXAMINATION PREPARATION</span>
          <h2>
            Continuous AI proctoring. Deterministic rankings.
            <br />
            Compete on the national merit leaderboard.
          </h2>
          <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
            <Link className="btn btn-white small" to="/student/available">
              Explore Available Exams <ArrowUpRight size={15} />
            </Link>
            <Link className="btn btn-glass small" to="/student/leaderboard">
              View Merit Leaderboards
            </Link>
          </div>
        </div>
        <div className="banner-illustration">✦</div>
      </div>
    </Shell>
  );
}

/* ==========================================================================
   Section 2: My Examinations (Registered Only)
   ========================================================================== */
export function MyExams() {
  const { token, user } = useAuth();
  const [registeredExams, setRegisteredExams] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [now, setNow] = useState(Date.now());

  // Real-time ticking every 10 seconds to update live countdowns and statuses
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const loadData = () => {
    setLoading(true);
    api("/me/dashboard", { token })
      .then((dashRes) => {
        setRegisteredExams(dashRes.registeredExams || []);
        setAttempts(dashRes.attempts || []);
        setRegistrations(dashRes.registrations || []);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const completedMap = new Map();
  attempts.forEach((a) => {
    if ((a.status === "submitted" || a.status === "TERMINATED") && a.result) {
      completedMap.set(a.examId, a);
    }
  });

  const inProgressMap = new Map();
  attempts.forEach((a) => {
    if (a.status === "in_progress") {
      inProgressMap.set(a.examId, a);
    }
  });

  const isCompletedExam = (exam) => {
    if (completedMap.has(exam.id)) return true;
    const schedule = getExamScheduleInfo(exam, new Date(now));
    return schedule.isCompleted;
  };

  const isLiveExam = (exam) => {
    if (completedMap.has(exam.id)) return false;
    const schedule = getExamScheduleInfo(exam, new Date(now));
    return schedule.isLive;
  };

  const isStartingSoonExam = (exam) => {
    if (completedMap.has(exam.id) || inProgressMap.has(exam.id)) return false;
    const schedule = getExamScheduleInfo(exam, new Date(now));
    return schedule.isStartingSoon;
  };

  const isUpcomingExam = (exam) => {
    if (completedMap.has(exam.id) || inProgressMap.has(exam.id)) return false;
    const schedule = getExamScheduleInfo(exam, new Date(now));
    return schedule.examStatus === "Scheduled";
  };

  const counts = {
    all: registeredExams.length,
    live: registeredExams.filter(isLiveExam).length,
    startingSoon: registeredExams.filter(isStartingSoonExam).length,
    upcoming: registeredExams.filter(isUpcomingExam).length,
    completed: registeredExams.filter(isCompletedExam).length,
  };

  const displayedExams = registeredExams.filter((exam) => {
    if (activeTab === "live") return isLiveExam(exam);
    if (activeTab === "startingSoon") return isStartingSoonExam(exam);
    if (activeTab === "upcoming") return isUpcomingExam(exam);
    if (activeTab === "completed") return isCompletedExam(exam);
    return true;
  });

  return (
    <Shell
      title="My Registered Examinations"
      kicker="STUDENT EXAMINATION PORTAL"
      description="All official competitive examinations, scheduled papers, and mock assessments registered under your account."
      action={
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-soft small" onClick={loadData} title="Refresh exam statuses">
            <RefreshCw size={14} /> Refresh
          </button>
          <Link to="/student/available" className="btn btn-outline small">
            <Plus size={15} /> Browse More Exams
          </Link>
          <Link to="/student/leaderboard" className="btn btn-primary small">
            <Trophy size={15} /> Merit Leaderboards
          </Link>
          <Link to="/student/results" className="btn btn-soft small">
            <BarChart3 size={15} /> Exam History
          </Link>
        </div>
      }
    >
      {/* Tab Filter Navigation */}
      <div className="catalog-category-chips" style={{ marginBottom: 20 }}>
        {[
          { id: "all", label: `All Registered (${counts.all})` },
          { id: "live", label: `🔴 Live Exams (${counts.live})` },
          { id: "startingSoon", label: `⏱️ Starting Soon (${counts.startingSoon})` },
          { id: "upcoming", label: `📅 Upcoming (${counts.upcoming})` },
          { id: "completed", label: `✓ Completed / Ended (${counts.completed})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`catalog-chip ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="alert error">{error}</div>}

      {loading ? (
        <Loading />
      ) : registeredExams.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "60px 20px" }}>
          <ClipboardList size={52} color="#94a3b8" style={{ margin: "0 auto 16px" }} />
          <h3 style={{ fontSize: 20, marginBottom: 8 }}>You Haven't Registered For Any Examinations Yet</h3>
          <p className="muted" style={{ maxWidth: 460, margin: "0 auto 24px" }}>
            Explore all published national and state-level competitive examinations, complete instant registration with your wallet, and start preparing.
          </p>
          <Link to="/student/available" className="btn btn-primary">
            Explore Available Exams <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : displayedExams.length === 0 ? (
        <Empty
          title={`No ${activeTab.replace(/([A-Z])/g, " $1").toLowerCase()} examinations`}
          text="Switch to 'All Registered' to view all your registered examinations."
        />
      ) : (
        <div
          className="home-course-grid"
          style={{ marginBottom: 40, gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}
        >
          {displayedExams.map((exam) => {
            const completedAttempt = completedMap.get(exam.id);
            const inProgressAttempt = inProgressMap.get(exam.id);
            const isCompleted = Boolean(completedAttempt);
            const isInProgress = Boolean(inProgressAttempt);
            const schedule = getExamScheduleInfo(exam, new Date(now));
            const reg = registrations.find((r) => r.examId === exam.id);

            const isExpiredWithoutAttempt = !isCompleted && !isInProgress && schedule.isCompleted;

            return (
              <ExamCard
                key={exam.id}
                exam={{
                  ...exam,
                  tag: isCompleted
                    ? `Score: ${completedAttempt.result?.score}/${exam.marks} (${completedAttempt.result?.accuracy}%)`
                    : isInProgress
                    ? "In Progress"
                    : schedule.examStatus,
                }}
                action={
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", width: "100%", justifyContent: "flex-end" }}>
                    {isCompleted ? (
                      <>
                        <Link
                          to={`/student/results`}
                          className="btn btn-outline small"
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "7px 11px", fontWeight: 700 }}
                        >
                          <BarChart3 size={13} /> Result
                        </Link>
                        <Link
                          to={`/student/leaderboard?examId=${exam.id}`}
                          className="btn btn-primary small"
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "7px 11px", fontWeight: 700 }}
                        >
                          <Trophy size={13} /> Merit Rank
                        </Link>
                      </>
                    ) : isExpiredWithoutAttempt ? (
                      <span className="tag gray" style={{ padding: "6px 10px", fontSize: 11, fontWeight: 700 }}>
                        Examination Window Expired
                      </span>
                    ) : isInProgress ? (
                      <Link
                        to={`/take/${exam.id}`}
                        className="btn btn-primary small"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, padding: "7px 14px", background: "#f59e0b", borderColor: "#d97706" }}
                      >
                        <Play size={13} fill="currentColor" /> Resume Exam
                      </Link>
                    ) : schedule.isLive ? (
                      <Link
                        to={`/take/${exam.id}`}
                        className="btn btn-primary small"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, padding: "7px 16px" }}
                      >
                        <Play size={13} fill="currentColor" /> Start Exam
                      </Link>
                    ) : schedule.isStartingSoon ? (
                      <button
                        disabled
                        className="btn btn-soft small"
                        style={{ padding: "7px 12px", fontWeight: 700, color: "#d97706", background: "#fef3c7", opacity: 0.9 }}
                      >
                        Starts in {formatCountdown(schedule.countdownMs)}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="btn btn-soft small"
                        style={{ padding: "7px 12px", fontWeight: 600, color: "#64748b", background: "#f1f5f9", opacity: 0.9 }}
                      >
                        Starts on {formatDate(schedule.startsAt)}
                      </button>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </Shell>
  );
}

export const MyCourses = MyExams;

/* ==========================================================================
   Section 3: Browse Available Examinations (Unregistered Only)
   ========================================================================== */
export function BrowseExams() {
  const { token } = useAuth();
  const { wallet, refresh: refreshWallet } = useWallet();
  const [allExams, setAllExams] = useState([]);
  const [registeredIds, setRegisteredIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedExam, setSelectedExam] = useState(null);
  const [showAddMoney, setShowAddMoney] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api("/exams", { token }),
      api("/me/dashboard", { token }).catch(() => ({ registeredExams: [], registrations: [] }))
    ])
      .then(([examRes, dashRes]) => {
        const published = examRes.exams || [];
        const regIds = new Set(
          (dashRes.registeredExams || dashRes.registrations || []).map((r) => r.id || r.examId)
        );
        setAllExams(published);
        setRegisteredIds(regIds);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Available Exams MUST NOT include already registered exams
  const availableExams = allExams.filter((e) => !registeredIds.has(e.id));

  const filtered = availableExams.filter((e) => {
    const matchesQuery = `${e.title} ${e.subject || ""} ${e.type || ""}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesCat =
      category === "all" ||
      (e.type && e.type.toLowerCase().includes(category.toLowerCase())) ||
      (e.subject && e.subject.toLowerCase().includes(category.toLowerCase()));
    return matchesQuery && matchesCat;
  });

  return (
    <Shell
      title="Available Examinations"
      kicker="OFFICIAL COMPETITIVE EXAMINATIONS"
      description="Browse and register for published competitive examinations. Single attempt only; fee deducted directly from your student wallet."
      action={
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 13, background: "#f1f5f9", padding: "6px 12px", borderRadius: 8 }}>
            Wallet: <strong style={{ color: "#10b981" }}>{money(wallet?.availableBalance ?? 0)}</strong>
          </div>
          <button className="btn btn-soft small" onClick={() => setShowAddMoney(true)}>
            <Plus size={14} /> Add Money
          </button>
          <Link to="/student/exams" className="btn btn-outline small">
            My Registered Exams ({registeredIds.size})
          </Link>
        </div>
      }
    >
      <div className="catalog-header-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search available examinations by title, subject, or pattern..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 2 }}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="demo-mode-badge">
          <ShieldCheck size={16} /> CLIENT-READY FRONTEND
        </div>
      </div>

      <div className="catalog-category-chips">
        {[
          { id: "all", label: "All Examinations" },
          { id: "jee", label: "⚡ Engineering (JEE Main & Adv)" },
          { id: "neet", label: "🩺 Medical Entrance (NEET UG)" },
          { id: "cet", label: "🎯 State Entrance (MHT-CET)" },
          { id: "java", label: "☕ Programming & IT Assessments" },
        ].map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`catalog-chip ${category === cat.id ? "active" : ""}`}
            onClick={() => setCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {error && <div className="alert error">{error}</div>}

      {loading ? (
        <Loading />
      ) : allExams.length > 0 && availableExams.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "60px 20px" }}>
          <CheckCircle2 size={54} color="#10b981" style={{ margin: "0 auto 16px" }} />
          <h3 style={{ fontSize: 20, marginBottom: 8 }}>All Caught Up! You're Registered for All Available Exams</h3>
          <p className="muted" style={{ maxWidth: 440, margin: "0 auto 24px" }}>
            You have registered for every active examination currently published by administrators. Check your registered papers to start testing.
          </p>
          <Link to="/student/exams" className="btn btn-primary">
            Go to My Registered Exams <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : filtered.length ? (
        <div
          className="home-course-grid"
          style={{ marginBottom: 40, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
        >
          {filtered.map((exam) => {
            const schedule = getExamScheduleInfo(exam);
            return (
              <ExamCard
                key={exam.id}
                exam={exam}
                action={
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Link
                      to={`/exams/${exam.id}`}
                      className="btn btn-outline small"
                      style={{ padding: "7px 11px", fontWeight: 600 }}
                    >
                      Details
                    </Link>
                    {!schedule.isRegistrationOpen ? (
                      <button
                        disabled
                        className="btn btn-soft small"
                        style={{ padding: "7px 12px", fontWeight: 700, opacity: 0.8 }}
                      >
                        {schedule.registrationStatus === "Upcoming Registration"
                          ? `Opens on ${formatDate(schedule.registrationOpensAt)}`
                          : "Registration Closed"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary small"
                        onClick={() => setSelectedExam(exam)}
                        style={{ padding: "7px 14px", fontWeight: 800 }}
                      >
                        Register Now
                      </button>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      ) : (
        <Empty
          title="No matching available examinations"
          text="Try searching with different terms or select another category."
        />
      )}

      {selectedExam && (
        <ExamRegistrationModal
          exam={selectedExam}
          wallet={wallet}
          onClose={() => setSelectedExam(null)}
          onRegistered={() => {
            setSelectedExam(null);
            loadData();
            refreshWallet();
          }}
          onAddMoney={(needed) => {
            setShowAddMoney(true);
          }}
        />
      )}

      {showAddMoney && (
        <AddMoneyModal
          isOpen={showAddMoney}
          onClose={() => setShowAddMoney(false)}
          currentBalance={wallet?.availableBalance ?? 0}
          onMoneyAdded={() => {
            refreshWallet();
            loadData();
          }}
        />
      )}
    </Shell>
  );
}

export const BrowseCourses = BrowseExams;

/* ==========================================================================
   Section 4: My Wallet & Transaction Ledger
   ========================================================================== */
export function MyWallet() {
  const { wallet, loading, error, refresh } = useWallet();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const transactions = (wallet?.transactions || []).filter((tx) => {
    const matchType =
      filter === "all" ||
      tx.type === filter ||
      (filter === "debit" && (tx.type === "debit" || tx.type === "exam_registration" || tx.type === "course_purchase" || tx.type === "withdrawal")) ||
      (filter === "credit" && (tx.type === "credit" || tx.type === "deposit" || tx.type === "refund"));

    const matchSearch =
      !search ||
      tx.referenceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      tx.description?.toLowerCase().includes(search.toLowerCase()) ||
      tx.id?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <Shell
      title="My Wallet"
      kicker="INDIVIDUAL STUDENT WALLET"
      description="Manage your funds in INR (₹). Simulated transactions in Demo Mode with instant row-level atomic ledger."
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline small" onClick={refresh}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="btn btn-primary small" onClick={() => setShowAddMoney(true)}>
            <Plus size={15} /> Add Money
          </button>
          <button className="btn btn-outline small" onClick={() => setShowWithdraw(true)}>
            <ArrowUpRight size={15} /> Withdraw
          </button>
          <Link to="/student/available" className="btn btn-soft small">
            Available Exams
          </Link>
        </div>
      }
    >
      {error && <div className="alert error">{error}</div>}

      {/* Prominent Balance Banner */}
      <div className="wallet-hero-card">
        <div className="wallet-hero-main">
          <span className="demo-pill">DEMO MODE · SIMULATED INR</span>
          <div className="wallet-hero-label">Available Wallet Balance</div>
          <div className="wallet-hero-balance">
            {money(wallet?.availableBalance ?? 0)}
          </div>
          <p className="wallet-hero-sub">
            Used for instant examination registrations and mock test enrollments.
          </p>
        </div>
        <div className="wallet-hero-actions">
          <button className="btn btn-white" onClick={() => setShowAddMoney(true)}>
            <Plus size={16} /> Add Money
          </button>
          <button className="btn btn-glass" onClick={() => setShowWithdraw(true)}>
            <ArrowUpRight size={16} /> Withdraw
          </button>
          <Link to="/student/available" className="btn btn-glass">
            <ArrowUpRight size={16} /> Browse Exams
          </Link>
        </div>
      </div>

      {/* Wallet Stats Breakdown */}
      <div className="grid-4" style={{ marginTop: 22 }}>
        <Stat
          icon={ArrowDownLeft}
          label="Total Deposited"
          value={money(wallet?.totalDeposited ?? 0)}
          tone="green"
          delta="Lifetime top-ups"
        />
        <Stat
          icon={BookOpen}
          label="Spent on Exams"
          value={money(wallet?.totalSpent ?? 0)}
          tone="purple"
          delta="Exam registrations"
        />
        <Stat
          icon={Wallet}
          label="Available Balance"
          value={money(wallet?.availableBalance ?? 0)}
          tone="cyan"
          delta="Ready for use"
        />
        <Stat
          icon={Clock3}
          label="Total Transactions"
          value={(wallet?.transactions || []).length}
          tone="default"
          delta="Ledger entries"
        />
      </div>

      {/* Demo Notice */}
      <div className="panel" style={{ marginTop: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldCheck size={20} color="#2563eb" />
          <h4 style={{ margin: 0 }}>Wallet Payment Security</h4>
        </div>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.8, marginTop: 8 }}>
          Examinations deduct registration fees directly from your student wallet upon confirmation.
          Negative balances are prevented, duplicate charges are blocked, and all debits/credits are immutably logged below.
        </p>
      </div>

      {/* Ledger Table */}
      <div className="panel" style={{ marginTop: 22 }}>
        <div className="panel-head">
          <div>
            <h3>Wallet Transaction Ledger</h3>
            <p className="muted">Complete record of credits, debits, exam fees, and adjustments.</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search reference or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: 13, padding: "6px 12px", width: 220 }}
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter transactions"
              style={{ fontSize: 13, padding: "6px 12px" }}
            >
              <option value="all">All Types</option>
              <option value="deposit">Deposits / Credits</option>
              <option value="exam_registration">Exam Registrations</option>
              <option value="withdrawal">Withdrawals</option>
              <option value="refund">Refunds</option>
            </select>
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : transactions.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Balance After</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isCredit = tx.type === "deposit" || tx.type === "refund";
                  return (
                    <tr key={tx.id}>
                      <td>
                        <code>{tx.id.slice(0, 14)}...</code>
                      </td>
                      <td>{new Date(tx.createdAt).toLocaleString("en-IN")}</td>
                      <td>
                        <span className="capitalize" style={{ fontWeight: 600 }}>
                          {tx.type === "exam_registration"
                            ? "Exam Registration"
                            : tx.type.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{tx.description}</td>
                      <td>
                        <code>{tx.referenceNumber || "—"}</code>
                      </td>
                      <td
                        style={{
                          fontWeight: 700,
                          color: isCredit ? "#10b981" : "#ef4444",
                        }}
                      >
                        {isCredit ? "+" : "-"}
                        {money(tx.amount)}
                      </td>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>
                        {tx.balanceAfter !== undefined ? money(tx.balanceAfter) : "—"}
                      </td>
                      <td>
                        <span
                          className={`tag ${
                            tx.status === "successful" || tx.status === "completed"
                              ? "green"
                              : tx.status === "pending"
                              ? "orange"
                              : "red"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No transactions found"
            text="Your wallet ledger has no recorded transactions matching your search criteria."
          />
        )}
      </div>

      {showAddMoney && (
        <AddMoneyModal
          isOpen={showAddMoney}
          onClose={() => setShowAddMoney(false)}
          currentBalance={wallet?.availableBalance ?? 0}
          onMoneyAdded={() => {
            refresh();
          }}
        />
      )}

      {showWithdraw && (
        <WithdrawMoneyModal
          isOpen={showWithdraw}
          onClose={() => setShowWithdraw(false)}
          currentBalance={wallet?.availableBalance ?? wallet?.balance ?? 0}
          onWithdrawn={() => {
            refresh();
          }}
        />
      )}
    </Shell>
  );
}

/* ==========================================================================
   Section 5: Add Money (Simulated Demo Payment Flow)
   ========================================================================== */
export function AddMoney() {
  const { token } = useAuth();
  const { wallet, refresh: refreshWallet } = useWallet();
  const navigate = useNavigate();

  const [amount, setAmount] = useState(500);
  const [method, setMethod] = useState("upi");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);

  const presets = [50, 100, 200, 500, 1000];

  async function handleDeposit(e) {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 1 || numAmount > 1000) {
      setError("Deposit amount must be between ₹1 and ₹1,000.");
      return;
    }
    setBusy(true);
    setError("");

    try {
      // 1. Create deposit order
      const orderRes = await api("/me/wallet/deposit/order", {
        method: "POST",
        token,
        body: { amount: Number(amount) },
      });

      // 2. Load Razorpay script
      const sdkReady = await loadRazorpayScript();

      if (sdkReady && window.Razorpay && orderRes.keyId && !orderRes.keyId.includes("demo")) {
        const options = {
          key: orderRes.keyId,
          amount: orderRes.amountPaise || Math.round(Number(amount) * 100),
          currency: "INR",
          name: "SW MERITX",
          description: "Wallet Balance Top-Up",
          order_id: orderRes.orderId && !orderRes.orderId.includes("test") ? orderRes.orderId : undefined,
          prefill: {
            name: wallet?.user?.name || "Student",
            email: wallet?.user?.email || "",
          },
          theme: { color: "#2563eb" },
          handler: async function (response) {
            setBusy(true);
            try {
              const verifyRes = await api("/me/wallet/deposit/verify", {
                method: "POST",
                token,
                body: {
                  amount: Number(amount),
                  orderId: response.razorpay_order_id || orderRes.orderId,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                  method: "Razorpay Official Gateway"
                },
              });
              setReceipt(verifyRes);
              refreshWallet();
            } catch (err) {
              setError(err.message || "Payment verification failed.");
            } finally {
              setBusy(false);
            }
          },
          modal: {
            ondismiss: function () {
              setBusy(false);
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", function (response) {
          setError(response.error?.description || "Payment failed or cancelled.");
          setBusy(false);
        });
        rzp.open();
        return;
      }

      // Fast test/demo recharge fallback
      const verifyRes = await api("/me/wallet/deposit/verify", {
        method: "POST",
        token,
        body: {
          amount: Number(amount),
          orderId: orderRes.orderId,
          paymentId: `pay_demo_${Date.now()}`,
          signature: "demo_sig_verified",
          method: "Instant Wallet Recharge (UPI/Demo)"
        },
      });

      setReceipt(verifyRes);
      refreshWallet();
    } catch (err) {
      setError(err.message || "Deposit simulation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Add Money"
      kicker="WALLET RECHARGE"
      description="Add funds to your individual student wallet using simulated Demo Mode payments."
      action={
        <div className="wallet-mini-pill">
          <Wallet size={16} />
          <span>Available: <strong>{money(wallet?.availableBalance ?? 0)}</strong></span>
        </div>
      }
    >
      <div className="panel" style={{ maxWidth: 680, margin: "0 auto" }}>
        <div className="demo-notice-banner">
          <ShieldCheck size={20} color="#2563eb" />
          <div>
            <strong>DEMO MODE: Simulated Payment Flow</strong>
            <p>
              In production, this initiates a Razorpay / UPI order. Test transactions will credit your
              demo wallet immediately without charging a real bank account.
            </p>
          </div>
        </div>

        {receipt ? (
          <div className="checkout-success-view" style={{ padding: "30px 10px" }}>
            <div className="checkout-success-icon">
              <CheckCircle2 size={54} color="#10b981" />
            </div>
            <h3>Wallet Credited Successfully!</h3>
            <p className="muted">
              Your deposit of <strong>{money(amount)}</strong> has been processed and credited to your
              student wallet ledger.
            </p>
            <div className="checkout-breakdown" style={{ marginTop: 20 }}>
              <div className="breakdown-row">
                <span>Transaction Reference</span>
                <code>{receipt.reference}</code>
              </div>
              <div className="breakdown-row">
                <span>Updated Available Balance</span>
                <strong style={{ color: "#10b981", fontSize: 18 }}>
                  {money(receipt.wallet?.availableBalance ?? 0)}
                </strong>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 26 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setReceipt(null);
                  setAmount(500);
                }}
              >
                Add More Funds
              </button>
              <Link to="/student/browse" className="btn btn-primary">
                Browse Exam Catalog <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleDeposit} style={{ marginTop: 20 }}>
            {error && <div className="alert error">{error}</div>}

            <div className="field">
              <label>Select or Enter Amount (INR ₹)</label>
              <div className="deposit-presets-grid">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`btn-preset ${amount === p ? "active" : ""}`}
                    onClick={() => setAmount(p)}
                  >
                    ₹{p.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>
              <div className="amount-input-wrap" style={{ marginTop: 12 }}>
                <span className="currency-prefix">₹</span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="Enter custom amount (₹1 - ₹1,000)"
                />
              </div>
              <small style={{ display: "block", color: "#64748b", marginTop: 6, fontSize: 12 }}>
                Minimum recharge ₹1, maximum ₹1,000 per transaction.
              </small>
            </div>

            <div className="field" style={{ marginTop: 24 }}>
              <label>Select Payment Method</label>
              <div className="payment-method-grid">
                <label className={`method-card ${method === "upi" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="method"
                    value="upi"
                    checked={method === "upi"}
                    onChange={(e) => setMethod(e.target.value)}
                  />
                  <Smartphone size={24} />
                  <div>
                    <strong>UPI (Instant)</strong>
                    <small>Google Pay, PhonePe, Paytm</small>
                  </div>
                </label>

                <label className={`method-card ${method === "card" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="method"
                    value="card"
                    checked={method === "card"}
                    onChange={(e) => setMethod(e.target.value)}
                  />
                  <CreditCard size={24} />
                  <div>
                    <strong>Debit / Credit Card</strong>
                    <small>Visa, Mastercard, RuPay</small>
                  </div>
                </label>

                <label className={`method-card ${method === "netbanking" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="method"
                    value="netbanking"
                    checked={method === "netbanking"}
                    onChange={(e) => setMethod(e.target.value)}
                  />
                  <Building size={24} />
                  <div>
                    <strong>Net Banking</strong>
                    <small>All Indian Major Banks</small>
                  </div>
                </label>
              </div>
            </div>

            {/* Review Box */}
            <div className="checkout-breakdown" style={{ marginTop: 24 }}>
              <div className="breakdown-row">
                <span>Deposit Amount</span>
                <strong>{money(amount)}</strong>
              </div>
              <div className="breakdown-row">
                <span>Payment Gateway Fee</span>
                <strong style={{ color: "#10b981" }}>FREE (₹0)</strong>
              </div>
              <div className="breakdown-divider" />
              <div className="breakdown-row">
                <span>Total Payable</span>
                <strong style={{ fontSize: 18 }}>{money(amount)}</strong>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 24 }}
              disabled={busy || !amount || Number(amount) < 1 || Number(amount) > 1000}
            >
              {busy ? "Processing Simulated Payment..." : `Proceed to Deposit ${money(amount)} (Demo)`}
            </button>
            <p className="checkout-safe-note" style={{ marginTop: 12 }}>
              <ShieldCheck size={14} /> Server-side order creation & cryptographic signature simulation.
            </p>
          </form>
        )}
      </div>
    </Shell>
  );
}

/* ==========================================================================
   Section 6: Withdraw Money (Fund Reservation & Admin Approval Workflow)
   ========================================================================== */
export function WithdrawMoney() {
  const { token } = useAuth();
  const { wallet, refresh: refreshWallet } = useWallet();
  const [withdrawals, setWithdrawals] = useState([]);
  const [amount, setAmount] = useState(500);
  const [payoutMethod, setPayoutMethod] = useState("upi");
  const [upiId, setUpiId] = useState("");
  const [bankAccount, setBankAccount] = useState({
    accountNumber: "",
    ifsc: "",
    holderName: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadWithdrawals = () => {
    api("/me/wallet/withdrawals", { token })
      .then((res) => setWithdrawals(res.withdrawals || []))
      .catch(() => {});
  };

  useEffect(() => {
    if (token) loadWithdrawals();
  }, [token]);

  const available = Number(wallet?.availableBalance ?? 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (amount <= 0) {
      setError("Please enter a valid withdrawal amount.");
      return;
    }
    if (amount > available) {
      setError(`Cannot withdraw more than available balance (${money(available)}).`);
      return;
    }

    const destination =
      payoutMethod === "upi"
        ? { upiId }
        : {
            accountNumber: bankAccount.accountNumber,
            ifsc: bankAccount.ifsc,
            holderName: bankAccount.holderName,
          };

    if (payoutMethod === "upi" && !upiId.includes("@")) {
      setError("Please enter a valid UPI ID (e.g., yourname@okhdfcbank).");
      return;
    }

    setBusy(true);
    setError("");
    setFeedback("");

    try {
      await api("/me/wallet/withdraw", {
        method: "POST",
        token,
        body: {
          amount: Number(amount),
          payoutMethod,
          destinationDetails: destination,
        },
      });

      setFeedback("Withdrawal request submitted! Funds have been reserved from your available balance.");
      setAmount(500);
      setUpiId("");
      setBankAccount({ accountNumber: "", ifsc: "", holderName: "" });
      refreshWallet();
      loadWithdrawals();
    } catch (err) {
      setError(err.message || "Failed to submit withdrawal request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Withdraw Money"
      kicker="PAYOUT REQUEST"
      description="Request withdrawal of eligible student wallet funds to your verified account."
      action={
        <div className="wallet-mini-pill">
          <Wallet size={16} />
          <span>Available: <strong>{money(available)}</strong></span>
        </div>
      }
    >
      <div className="grid-2">
        {/* Request Form */}
        <div className="panel">
          <div className="panel-head">
            <h3>New Withdrawal Request</h3>
            <span className="demo-pill">DEMO SIMULATION</span>
          </div>

          <div className="demo-notice-banner" style={{ margin: "14px 0" }}>
            <ShieldCheck size={18} color="#2563eb" />
            <div>
              <strong>Funds Reservation Policy</strong>
              <p>
                Requested funds are immediately locked and deducted from your available balance. An
                admin will review your request. If approved, status changes to Completed. If
                rejected, reserved funds are safely restored to your available balance.
              </p>
            </div>
          </div>

          {error && <div className="alert error">{error}</div>}
          {feedback && <div className="alert success">{feedback}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Withdrawal Amount (INR ₹)</label>
              <div className="amount-input-wrap">
                <span className="currency-prefix">₹</span>
                <input
                  type="number"
                  min="100"
                  max={available}
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="Amount to withdraw"
                />
              </div>
              <small className="muted">
                Available to withdraw: <strong>{money(available)}</strong>
              </small>
            </div>

            <div className="field" style={{ marginTop: 18 }}>
              <label>Payout Destination</label>
              <div className="radio-group-tabs">
                <label className={`radio-tab ${payoutMethod === "upi" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="payoutMethod"
                    value="upi"
                    checked={payoutMethod === "upi"}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                  />
                  UPI ID (VPA)
                </label>
                <label className={`radio-tab ${payoutMethod === "bank_transfer" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="payoutMethod"
                    value="bank_transfer"
                    checked={payoutMethod === "bank_transfer"}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                  />
                  Bank Account
                </label>
              </div>
            </div>

            {payoutMethod === "upi" ? (
              <div className="field">
                <label>UPI ID / Virtual Payment Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. mobile@upi or username@okhdfcbank"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="field">
                  <label>Account Holder Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Full name as in bank passbook"
                    value={bankAccount.holderName}
                    onChange={(e) =>
                      setBankAccount({ ...bankAccount, holderName: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Bank Account Number</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter account number"
                    value={bankAccount.accountNumber}
                    onChange={(e) =>
                      setBankAccount({ ...bankAccount, accountNumber: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>IFSC Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC0001234"
                    value={bankAccount.ifsc}
                    onChange={(e) =>
                      setBankAccount({ ...bankAccount, ifsc: e.target.value.toUpperCase() })
                    }
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 20 }}
              disabled={busy || amount > available || amount <= 0}
            >
              {busy ? "Submitting Request..." : `Request Withdrawal of ${money(amount)}`}
            </button>
          </form>
        </div>

        {/* Request History */}
        <div className="panel">
          <div className="panel-head">
            <h3>Withdrawal Request History</h3>
          </div>
          {withdrawals.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Destination</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{new Date(w.createdAt).toLocaleDateString("en-IN")}</div>
                        <code style={{ fontSize: 10 }}>{w.id.slice(0, 8)}</code>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <span className="capitalize">{w.payoutMethod?.replace("_", " ")}</span>
                        {w.destinationDetails?.upiId && (
                          <div style={{ color: "#64748b" }}>{w.destinationDetails.upiId}</div>
                        )}
                        {w.destinationDetails?.accountNumber && (
                          <div style={{ color: "#64748b" }}>
                            A/C ...{w.destinationDetails.accountNumber.slice(-4)} ({w.destinationDetails.ifsc})
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 700 }}>{money(w.amount)}</td>
                      <td>
                        <span
                          className={`tag ${
                            w.status === "approved" || w.status === "completed"
                              ? "green"
                              : w.status === "pending"
                              ? "orange"
                              : "red"
                          }`}
                        >
                          {w.status}
                        </span>
                        {w.rejectionReason && (
                          <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
                            {w.rejectionReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No withdrawal requests"
              text="Your submitted payout requests will appear here with real-time status updates."
            />
          )}
        </div>
      </div>
    </Shell>
  );
}

/* ==========================================================================
   Section 7: Deposit History
   ========================================================================== */
export function DepositHistory() {
  const { wallet, loading, error, refresh } = useWallet();

  const deposits = (wallet?.transactions || []).filter((tx) => tx.type === "deposit");

  return (
    <Shell
      title="Deposit History"
      kicker="WALLET RECORDS"
      description="History of all successful and pending wallet top-ups."
      action={
        <Link to="/student/deposit" className="btn btn-primary small">
          <Plus size={16} /> Add Money
        </Link>
      }
    >
      {error && <div className="alert error">{error}</div>}
      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>Wallet Top-up History</h3>
            <p className="muted">Total Deposits: <strong>{money(wallet?.totalDeposited ?? 0)}</strong></p>
          </div>
          <button className="btn btn-outline small" onClick={refresh}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <Loading />
        ) : deposits.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Reference Number</th>
                  <th>Payment Mode</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((tx) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.createdAt).toLocaleString("en-IN")}</td>
                    <td>
                      <code>{tx.referenceNumber || tx.id}</code>
                    </td>
                    <td>
                      <span className="capitalize">{tx.metadata?.paymentMethod || "UPI"}</span>
                    </td>
                    <td style={{ color: "#10b981", fontWeight: 700 }}>
                      +{money(tx.amount)}
                    </td>
                    <td>
                      <span className="tag green">{tx.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No deposits recorded"
            text="Add money to your student wallet to see deposit records here."
          />
        )}
      </div>
    </Shell>
  );
}

/* ==========================================================================
   Section 8: Transaction History
   ========================================================================== */
export function TransactionHistory() {
  const { wallet, loading, error, refresh } = useWallet();
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const transactions = (wallet?.transactions || []).filter((tx) => {
    const matchType = filter === "all" || tx.type === filter;
    const matchStatus = statusFilter === "all" || tx.status === statusFilter;
    const matchSearch =
      !search ||
      tx.referenceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      tx.description?.toLowerCase().includes(search.toLowerCase()) ||
      tx.id?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchStatus && matchSearch;
  });

  return (
    <Shell
      title="Transaction History"
      kicker="FINANCIAL AUDIT"
      description="Detailed ledger of all credits, course debits, withdrawals, and refunds."
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline small" onClick={refresh}>
            <RefreshCw size={14} /> Refresh
          </button>
          <Link to="/student/deposit" className="btn btn-primary small">
            <Plus size={14} /> Add Money
          </Link>
        </div>
      }
    >
      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        <div className="panel-head">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search reference, description, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: 13, padding: "7px 12px", minWidth: 240 }}
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ fontSize: 13, padding: "7px 12px" }}
            >
              <option value="all">All Types</option>
              <option value="deposit">Deposits</option>
              <option value="course_purchase">Course Purchases</option>
              <option value="withdrawal">Withdrawals</option>
              <option value="refund">Refunds</option>
              <option value="adjustment">Adjustments</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: 13, padding: "7px 12px" }}
            >
              <option value="all">All Statuses</option>
              <option value="successful">Successful</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="reversed">Reversed</option>
            </select>
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : transactions.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Reference Number</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isCredit = tx.type === "deposit" || tx.type === "refund";
                  return (
                    <tr key={tx.id}>
                      <td>
                        <code>{tx.id.slice(0, 10)}...</code>
                      </td>
                      <td>{new Date(tx.createdAt).toLocaleString("en-IN")}</td>
                      <td>
                        <span className="capitalize" style={{ fontWeight: 600 }}>
                          {tx.type?.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{tx.description}</td>
                      <td>
                        <code>{tx.referenceNumber || "—"}</code>
                      </td>
                      <td
                        style={{
                          fontWeight: 700,
                          color: isCredit ? "#10b981" : "#ef4444",
                        }}
                      >
                        {isCredit ? "+" : "-"}
                        {money(tx.amount)}
                      </td>
                      <td>
                        <span
                          className={`tag ${
                            tx.status === "successful" || tx.status === "completed"
                              ? "green"
                              : tx.status === "pending"
                              ? "orange"
                              : "red"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No matching transactions" text="Try resetting filters or search query." />
        )}
      </div>
    </Shell>
  );
}

/* ==========================================================================
   Section 9: Profile and Settings
   ========================================================================== */
export function StudentProfile() {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState({
    phone: "",
    bio: "",
    city: "",
    state: "",
    targetExam: "JEE Main",
    academicYear: "2025-2026",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (token) {
      api("/me/profile", { token })
        .then((res) => {
          if (res.profile) {
            setProfile({
              phone: res.profile.phone || "",
              bio: res.profile.bio || "",
              city: res.profile.city || "",
              state: res.profile.state || "",
              targetExam: res.profile.targetExam || "JEE Main",
              academicYear: res.profile.academicYear || "2025-2026",
            });
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [token]);

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErr("");

    try {
      await api("/me/profile", {
        method: "PUT",
        token,
        body: profile,
      });
      setMsg("Profile details saved successfully.");
    } catch (e) {
      setErr(e.message || "Failed to save profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Profile & Settings"
      kicker="ACCOUNT MANAGEMENT"
      description="Update your personal details, academic goals, and contact information."
    >
      <div className="panel" style={{ maxWidth: 650, margin: "0 auto" }}>
        {msg && <div className="alert success">{msg}</div>}
        {err && <div className="alert error">{err}</div>}

        {loading ? (
          <Loading />
        ) : (
          <form onSubmit={handleSave}>
            <div className="grid-2">
              <div className="field">
                <label>Student Name</label>
                <input type="text" disabled value={user?.name || ""} />
                <small className="muted">Name is linked to your registered login account.</small>
              </div>
              <div className="field">
                <label>Email Address</label>
                <input type="email" disabled value={user?.email || ""} />
                <small className="muted">Primary email cannot be modified.</small>
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 14 }}>
              <div className="field">
                <label>Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Target Examination</label>
                <select
                  value={profile.targetExam}
                  onChange={(e) => setProfile({ ...profile, targetExam: e.target.value })}
                >
                  <option value="JEE Main">JEE Main</option>
                  <option value="JEE Advanced">JEE Advanced</option>
                  <option value="NEET UG">NEET UG</option>
                  <option value="UPSC CSE">UPSC CSE</option>
                  <option value="Foundation">Foundation (Class 9-10)</option>
                  <option value="Other">Other Examination</option>
                </select>
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 14 }}>
              <div className="field">
                <label>City</label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai, Kota, Delhi"
                  value={profile.city}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                />
              </div>
              <div className="field">
                <label>State</label>
                <input
                  type="text"
                  placeholder="e.g. Maharashtra, Rajasthan"
                  value={profile.state}
                  onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                />
              </div>
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label>Academic Year</label>
              <input
                type="text"
                placeholder="e.g. 2025-2026"
                value={profile.academicYear}
                onChange={(e) => setProfile({ ...profile, academicYear: e.target.value })}
              />
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label>Bio / Preparation Goals</label>
              <textarea
                rows="4"
                placeholder="Briefly describe your study targets and timeline..."
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: 18 }}
              disabled={busy}
            >
              {busy ? "Saving Changes..." : "Save Profile Details"}
            </button>
          </form>
        )}
      </div>
    </Shell>
  );
}

/* ==========================================================================
   Existing Components: Results, Rewards, Support (Maintained)
   ========================================================================== */
/* ==========================================================================
   Exam History & Past Results (Dedicated Previous Exams Section)
   ========================================================================== */
export function Results() {
  const { data } = useStudent();
  const [exams, setExams] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [reviewId, setReviewId] = useState(null);

  useEffect(() => {
    api("/exams").then((d) => setExams(d.exams || []));
    api("/me/dashboard").then((d) => {
      setRegistrations(d.registrations || []);
    }).catch(() => {});
  }, []);

  const completedAttempts = (data?.attempts || []).filter(
    (a) => (a.status === "submitted" || a.status === "TERMINATED") && a.result
  );

  return (
    <Shell
      title="Previous Exams & Results History"
      kicker="PERFORMANCE & ANALYTICS"
      description="Review every completed assessment attempt, evaluation breakdown, accuracy, and national leaderboard standing."
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/student/leaderboard" className="btn btn-primary small">
            <Trophy size={15} /> National Leaderboards
          </Link>
          <Link to="/student/exams" className="btn btn-outline small">
            <ClipboardList size={15} /> My Active Exams
          </Link>
        </div>
      }
    >
      {!data ? (
        <Loading />
      ) : (
        <div className="panel">
          {completedAttempts.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Examination</th>
                    <th>Fee Paid</th>
                    <th>Submission Date</th>
                    <th>Marks / Total</th>
                    <th>Percentage</th>
                    <th>Accuracy</th>
                    <th>Status</th>
                    <th>Leaderboard</th>
                    <th>Solution Review</th>
                  </tr>
                </thead>
                <tbody>
                  {completedAttempts.map((a) => {
                    const exam = exams.find((e) => e.id === a.examId) || {};
                    const reg = registrations.find((r) => r.examId === a.examId);
                    const totalMarks = a.result.totalMarks || exam.marks || (a.result.total * 4);
                    const obtainedMarks = a.result.score;
                    const percentage = a.result.percentage ?? Math.max(0, Math.round((obtainedMarks / (totalMarks || 1)) * 100));
                    const isTerminated = a.status === "TERMINATED";

                    return (
                      <tr key={a.id}>
                        <td>
                          <strong>{exam.title || a.examId}</strong>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{exam.subject || exam.type || "Mock Assessment"}</div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>
                            {reg?.amount ? money(reg.amount) : exam.fee ? money(exam.fee) : "FREE"}
                          </span>
                        </td>
                        <td>
                          {new Date(a.submittedAt || a.completedAt || a.startedAt || Date.now()).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </td>
                        <td>
                          <strong style={{ fontSize: 14, color: isTerminated ? "#dc2626" : "#0f172a" }}>
                            {obtainedMarks}
                          </strong>{" "}
                          <span style={{ color: "#64748b" }}>/ {totalMarks}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: percentage >= 50 ? "#10b981" : "#f59e0b" }}>
                            {percentage}%
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{a.result.accuracy}%</span>
                        </td>
                        <td>
                          {isTerminated ? (
                            <span className="tag red" style={{ fontWeight: 800 }}>TERMINATED</span>
                          ) : percentage >= 40 ? (
                            <span className="tag green" style={{ fontWeight: 700 }}>QUALIFIED</span>
                          ) : (
                            <span className="tag orange" style={{ fontWeight: 700 }}>EVALUATED</span>
                          )}
                        </td>
                        <td>
                          <Link
                            to={`/student/leaderboard?examId=${a.examId}`}
                            className="btn btn-soft small"
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700 }}
                          >
                            <Trophy size={13} /> Rank
                          </Link>
                        </td>
                        <td>
                          <button
                            className="btn btn-outline small"
                            onClick={() => setReviewId(reviewId === a.id ? null : a.id)}
                            style={{ fontWeight: 700 }}
                          >
                            {reviewId === a.id ? "Hide Review" : "Review Solutions"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "50px 20px" }}>
              <Trophy size={48} color="#94a3b8" style={{ margin: "0 auto 16px" }} />
              <h3>No Examination Attempts Completed Yet</h3>
              <p className="muted" style={{ maxWidth: 440, margin: "0 auto 20px" }}>
                Complete an examination from your registered list to view your marks breakdown, accuracy, and ranking here.
              </p>
              <Link to="/student/exams" className="btn btn-primary small">
                Go to My Registered Exams
              </Link>
            </div>
          )}

          {completedAttempts
            .filter((attempt) => attempt.id === reviewId)
            .map((attempt) => (
              <div className="review-section" key={attempt.id} style={{ marginTop: 30, borderTop: "2px solid #e2e8f0", paddingTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ margin: 0 }}>Detailed Answer Review & Solution Key</h3>
                  <button className="btn btn-soft small" onClick={() => setReviewId(null)}>
                    Close Review
                  </button>
                </div>
                {(attempt.questions || attempt.questionSnapshot || []).map((question, index) => {
                  const detail = attempt.result.details?.find(
                    (item) => item.id === question.id
                  );
                  return (
                    <article className="review-item" key={question.id || index}>
                      <strong>
                        Question {index + 1} · {question.subject || "General"} · {question.chapter || "Unit"}
                      </strong>
                      <QuestionRenderer
                        question={question}
                        selected={detail?.selectedOptions || []}
                        disabled
                        showAnswer
                      />
                      <p>
                        <b>Status:</b>{" "}
                        {!detail?.attempted
                          ? "Unanswered"
                          : detail.isCorrect
                          ? "Correct"
                          : "Incorrect"}
                      </p>
                      <p>
                        <b>Your answer:</b>{" "}
                        {detail?.attempted
                          ? (detail.selectedOptions || [])
                              .map((value) => String.fromCharCode(65 + value))
                              .join(", ")
                          : "Not answered"}{" "}
                        · <b>Correct:</b>{" "}
                        {(detail?.correctOptions || []).map((value) =>
                          String.fromCharCode(65 + value)
                        ).join(", ")}
                      </p>
                      {question.explanation && (
                        <p>
                          <b>Explanation:</b> {question.explanation}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            ))}
        </div>
      )}
    </Shell>
  );
}

export const PreviousExams = Results;
export const ExamHistory = Results;

export function Rewards() {
  return <MyWallet />;
}

export function Support() {
  const { token } = useAuth();
  const [subject, setSubject] = useState("Exam issue"),
    [message, setMessage] = useState(""),
    [feedback, setFeedback] = useState(""),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setFeedback("");
    try {
      await api("/support", {
        method: "POST",
        token,
        body: { subject, message },
      });
      setFeedback("Your support ticket has been saved.");
      setMessage("");
    } catch (e) {
      setFailed(true);
      setFeedback(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell
      title="Help & Support"
      kicker="WE'RE HERE FOR YOU"
      description="Something not working? Reach the support team."
    >
      <div className="panel" style={{ maxWidth: 650 }}>
        <form onSubmit={submit}>
          <div className="field">
            <label>Issue category</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={busy}
            >
              {[
                "Exam issue",
                "Payment issue",
                "Registration",
                "Result & ranking",
                "Technical issue",
                "Other",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>What happened?</label>
            <textarea
              rows={6}
              required
              minLength={10}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue..."
              disabled={busy}
            />
          </div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Submitting..." : "Submit Ticket"}
          </button>
          {feedback && (
            <div
              className={"alert " + (failed ? "error" : "success")}
              role="status"
            >
              {feedback}
            </div>
          )}
        </form>
      </div>
    </Shell>
  );
}
