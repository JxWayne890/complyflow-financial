import React from 'react';
import { History, Sparkles, CheckCircle2, Zap, ShieldCheck } from 'lucide-react';

const Changelog: React.FC = () => {
    const updates = [
        {
            date: 'February 10, 2026',
            time: '11:45 AM CST',
            title: 'Select & Fix Context Menu',
            description: 'Introduced a surgical AI editing toolbar. Highlight any text to rewrite, shorten, expand, or fix specific compliance concerns instantly.',
            type: 'feature',
            icon: <Sparkles className="text-violet-500" size={20} />
        },
        {
            date: 'February 10, 2026',
            time: '03:45 AM CST',
            title: 'Content Extension & Animation',
            description: 'Added "Extend Content" feature to naturally grow drafts. New sections now feature a highlight pulse animation to easily identify AI additions.',
            type: 'feature',
            icon: <Zap className="text-amber-500" size={20} />
        },
        {
            date: 'February 10, 2026',
            time: '02:30 AM CST',
            title: 'Model Migration: Kimi K2.5',
            description: 'Migrated core AI engine to Kimi K2.5 via NVIDIA NIM for improved financial reasoning and "Legacy Wealth" brand voice alignment.',
            type: 'improvement',
            icon: <CheckCircle2 className="text-emerald-500" size={20} />
        },
        {
            date: 'February 9, 2026',
            time: '10:15 PM CST',
            title: 'Content Length Controls',
            description: 'Added precise length selectors (Short, Medium, Long) to the content generator, allowing for better control over article depth.',
            type: 'feature',
            icon: <ShieldCheck className="text-blue-500" size={20} />
        }
    ];

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center">
                    <History className="text-primary-600" size={24} />
                </div>
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">System Changelog</h1>
                    <p className="text-slate-500">Track all updates and improvements to the ComplyFlow platform.</p>
                </div>
            </div>

            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-6 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent">
                {updates.map((update, index) => (
                    <div key={index} className="relative flex items-start gap-8 group">
                        {/* Timeline dot */}
                        <div className="absolute left-6 -translate-x-1/2 w-4 h-4 rounded-full border-4 border-white bg-primary-500 shadow-sm z-10 transition-transform group-hover:scale-125"></div>

                        <div className="flex-1 ml-12">
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 transition-all duration-300 hover:shadow-md hover:border-primary-100">
                                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-primary-50 transition-colors">
                                            {update.icon}
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 leading-none">{update.title}</h3>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full">
                                        <span>{update.date}</span>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                        <span>{update.time}</span>
                                    </div>
                                </div>
                                <p className="text-slate-600 leading-relaxed">
                                    {update.description}
                                </p>
                                {update.type === 'feature' && (
                                    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-primary-600 bg-primary-50 w-fit px-2.5 py-1 rounded-md uppercase tracking-wide">
                                        New Feature
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Changelog;
