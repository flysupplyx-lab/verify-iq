import React, { useState, useEffect } from 'react';
import { Shield, User, Activity, AlertTriangle, Settings, Scan, CheckCircle, XCircle, ChevronRight, Lock } from 'lucide-react';

// Types for our trusted metrics
interface Metric {
    label: string;
    value: string;
    trend?: 'up' | 'down' | 'neutral';
    status: 'good' | 'warning' | 'bad';
    icon: React.ElementType;
}

const TrustScorePopup: React.FC = () => {
    const [score, setScore] = useState(0);
    const [isScanning, setIsScanning] = useState(false);
    const [scanComplete, setScanComplete] = useState(false);

    // Target score for the demo
    const TARGET_SCORE = 94;

    useEffect(() => {
        // Initial entrance animation
        const timer = setTimeout(() => {
            // In a real app, this would be the saved state or 0
            setScore(0);
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    const handleScan = () => {
        setIsScanning(true);
        setScore(0);
        setScanComplete(false);

        // Simulated scanning process
        let currentScore = 0;
        const interval = setInterval(() => {
            currentScore += 2;
            if (currentScore >= TARGET_SCORE) {
                currentScore = TARGET_SCORE;
                clearInterval(interval);
                setIsScanning(false);
                setScanComplete(true);
            }
            setScore(currentScore);
        }, 20); // Fast scan for UX
    };

    // Dynamic Styles based on Score
    const getStatusColor = (currentScore: number) => {
        if (currentScore >= 80) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shadow-emerald-500/20';
        if (currentScore >= 50) return 'text-amber-400 border-amber-500/30 bg-amber-500/10 shadow-amber-500/20';
        return 'text-rose-500 border-rose-500/30 bg-rose-500/10 shadow-rose-500/20';
    };

    const statusColor = getStatusColor(score);
    const ringColor = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#F43F5E';

    // Circular Progress Calculation
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
        <div className="w-[380px] h-[600px] bg-slate-950 text-slate-50 font-sans relative overflow-hidden flex flex-col font-inter selection:bg-emerald-500/30">

            {/* Background Ambience */}
            <div className="absolute top-[-20%] left-[-20%] w-[300px] h-[300px] bg-emerald-500/20 rounded-full blur-[100px] opacity-20 pointer-events-none animate-pulse-slow" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[250px] h-[250px] bg-indigo-500/20 rounded-full blur-[80px] opacity-20 pointer-events-none" />

            {/* Header */}
            <header className="flex items-center justify-between px-6 py-5 z-10 border-b border-slate-800/50 backdrop-blur-md bg-slate-900/50">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gradient-to-tr from-emerald-500 to-cyan-500 rounded-lg shadow-lg shadow-emerald-500/20">
                        <Shield className="w-4 h-4 text-white" fill="currentColor" />
                    </div>
                    <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                        Verify<span className="font-light text-emerald-400">IQ</span>
                    </span>
                </div>
                <button className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                    <Settings className="w-5 h-5" />
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col px-6 py-8 z-10 overflow-y-auto no-scrollbar">

                {/* Status Badge */}
                <div className="flex justify-center mb-8">
                    <div className={`
                flex items-center gap-2 px-4 py-1.5 rounded-full border backdrop-blur-md transition-all duration-500
                ${score > 0 ? statusColor : 'text-slate-400 border-slate-700 bg-slate-800/50'}
            `}>
                        {score >= 80 ? <CheckCircle className="w-4 h-4" /> :
                            score >= 50 ? <AlertTriangle className="w-4 h-4" /> :
                                score > 0 ? <XCircle className="w-4 h-4" /> : <Scan className="w-4 h-4 animate-pulse" />}

                        <span className="text-xs font-semibold uppercase tracking-wider">
                            {score === 0 ? 'Ready to Scan' :
                                score >= 80 ? 'Authenticity Verified' :
                                    score >= 50 ? 'Caution Advisory' : 'High Risk Detected'}
                        </span>
                    </div>
                </div>

                {/* Hero Circular Gauge */}
                <div className="relative flex items-center justify-center mb-10 group">
                    {/* Outer Glow Ring */}
                    <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 transition-all duration-700 ${score > 0 ? `bg-[${ringColor}]` : 'bg-transparent'}`} />

                    {/* SVG Progress */}
                    <svg className="w-48 h-48 transform -rotate-90 drop-shadow-2xl">
                        {/* Track */}
                        <circle
                            cx="96"
                            cy="96"
                            r={radius}
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            className="text-slate-800/50"
                        />
                        {/* Indicator */}
                        <circle
                            cx="96"
                            cy="96"
                            r={radius}
                            stroke={ringColor}
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                            style={{ filter: `drop-shadow(0 0 6px ${ringColor})` }}
                        />
                    </svg>

                    {/* Center Text */}
                    <div className="absolute flex flex-col items-center">
                        <span className={`text-5xl font-bold tracking-tighter transition-colors duration-300 ${score > 0 ? 'text-white' : 'text-slate-600'}`}>
                            {score}
                        </span>
                        <span className={`text-sm font-medium tracking-wide mt-1 uppercase transition-colors duration-300 ${score > 0 ? 'text-slate-300' : 'text-slate-600'}`}>
                            {score === 0 ? 'No Data' : score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Poor'}
                        </span>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                    <MetricCard
                        label="Engagement Rate"
                        value={scanComplete ? "4.5%" : "--"}
                        icon={Activity}
                        status={scanComplete ? "good" : "neutral"}
                        delay={0}
                    />
                    <MetricCard
                        label="Account Age"
                        value={scanComplete ? "2 Years" : "--"}
                        icon={User}
                        status={scanComplete ? "good" : "neutral"}
                        delay={100}
                    />
                    <MetricCard
                        label="Bot Probability"
                        value={scanComplete ? "Low" : "--"}
                        icon={AlertTriangle}
                        status={scanComplete ? "good" : "neutral"}
                        delay={200}
                    />
                    <MetricCard
                        label="Real Followers"
                        value={scanComplete ? "98%" : "--"}
                        icon={Shield}
                        status={scanComplete ? "good" : "neutral"}
                        delay={300}
                    />
                </div>

                {/* Scan Button */}
                <div className="mt-auto">
                    <button
                        onClick={handleScan}
                        disabled={isScanning}
                        className={`
                    w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-300
                    flex items-center justify-center gap-2 group relative overflow-hidden
                    ${isScanning
                                ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transform hover:-translate-y-0.5 active:translate-y-0'}
                `}
                    >
                        {isScanning ? (
                            <>
                                <Scan className="w-4 h-4 animate-spin-slow" />
                                Scanning Profile...
                            </>
                        ) : (
                            <>
                                <span className="relative z-10">Scan Profile</span>
                                <ChevronRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
                                {/* Shine Effect */}
                                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0" />
                            </>
                        )}
                    </button>
                    <p className="text-center text-[10px] text-slate-500 mt-4 flex items-center justify-center gap-1">
                        <Lock className="w-3 h-3" /> Encrypted & Anonymous Analysis
                    </p>
                </div>

            </main>
        </div>
    );
};

// Sub-component for individual metrics
const MetricCard = ({ label, value, icon: Icon, status, delay }: any) => {
    const getStatusColor = () => {
        switch (status) {
            case 'good': return 'text-emerald-400 bg-emerald-500/5 border-emerald-500/20';
            case 'warning': return 'text-amber-400 bg-amber-500/5 border-amber-500/20';
            case 'bad': return 'text-rose-400 bg-rose-500/5 border-rose-500/20';
            default: return 'text-slate-400 bg-slate-800/50 border-slate-700/50';
        }
    };

    return (
        <div
            className={`p-3 rounded-xl border backdrop-blur-sm transition-all duration-500 hover:bg-slate-800/80 ${getStatusColor()}`}
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="flex items-start justify-between mb-1">
                <Icon className="w-4 h-4 opacity-70" />
                {status === 'good' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />}
            </div>
            <div className="text-lg font-bold tracking-tight text-white mb-0.5">{value}</div>
            <div className="text-[10px] uppercase font-semibold opacity-60 tracking-wider">{label}</div>
        </div>
    );
};

export default TrustScorePopup;
