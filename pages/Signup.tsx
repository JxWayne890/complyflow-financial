import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, UserPlus, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { UserRole } from '../types';

const Signup: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [role, setRole] = useState<UserRole>(UserRole.ADVISOR);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const firstName = (e.target as any).firstName.value;
        const lastName = (e.target as any).lastName.value;
        const email = (e.target as any).email.value;
        const password = (e.target as any).password.value;
        const confirmPassword = (e.target as any).confirmPassword.value;

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: `${firstName} ${lastName}`.trim(),
                        first_name: firstName,
                        last_name: lastName,
                        role: role
                    }
                }
            });

            if (error) throw error;

            if (data.session) {
                navigate('/');
            } else if (data.user) {
                // If email confirmation is required, this block runs
                alert('Signup successful! Please check your email for confirmation.');
                navigate('/login');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during signup');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 md:p-10">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-600/30">
                        <ShieldCheck className="text-white" size={24} />
                    </div>
                    <h1 className="text-2xl font-display font-bold text-slate-900 mb-2">Create Account</h1>
                    <p className="text-slate-500 text-sm">Start your compliance journey with ComplyFlow</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
                        <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                <div className="mb-8 p-1 bg-slate-100 rounded-xl flex gap-1">
                    <button
                        type="button"
                        onClick={() => setRole(UserRole.ADVISOR)}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${role === UserRole.ADVISOR
                            ? 'bg-white text-primary-700 shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            }`}
                    >
                        Advisor
                    </button>
                    <button
                        type="button"
                        onClick={() => setRole(UserRole.COMPLIANCE)}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${role === UserRole.COMPLIANCE
                            ? 'bg-white text-primary-700 shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            }`}
                    >
                        Compliance Team
                    </button>
                </div>

                <form onSubmit={handleSignup} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name</label>
                            <input
                                name="firstName"
                                type="text"
                                required
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                placeholder="John"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name</label>
                            <input
                                name="lastName"
                                type="text"
                                required
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                placeholder="Doe"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                        <input
                            name="email"
                            type="email"
                            required
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                            placeholder="name@company.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                        <input
                            name="password"
                            type="password"
                            required
                            minLength={6}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                            placeholder="••••••••"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
                        <input
                            name="confirmPassword"
                            type="password"
                            required
                            minLength={6}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-base"
                    >
                        {loading ? 'Creating Account...' : (
                            <>
                                <UserPlus size={20} />
                                Join as {role === UserRole.ADVISOR ? 'Advisor' : 'Compliance'}
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center pt-6 border-t border-slate-100">
                    <p className="text-sm text-slate-500">
                        Already have an account?{' '}
                        <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Signup;
