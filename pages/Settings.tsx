import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Profile } from '../types';
import { Settings as SettingsIcon, Bell, Loader2, Save } from 'lucide-react';

interface SettingsProps {
  profile: Profile;
}

const Settings: React.FC<SettingsProps> = ({ profile }) => {
  const [enableReviewEmails, setEnableReviewEmails] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchOrgSettings();
  }, [profile.org_id]);

  const fetchOrgSettings = async () => {
    if (!profile?.org_id) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('organizations')
        .select('enable_review_emails')
        .eq('id', profile.org_id)
        .single();
        
      if (error) {
        // If column doesn't exist yet, we can gracefully fallback
        console.warn('Could not fetch org settings:', error);
      } else if (data) {
        setEnableReviewEmails(data.enable_review_emails ?? false);
      }
    } catch (err) {
      console.error('Error fetching org settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile?.org_id) return;
    
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMsg(null);
      
      const { error } = await supabase
        .from('organizations')
        .update({ enable_review_emails: enableReviewEmails })
        .eq('id', profile.org_id);
        
      if (error) throw error;
      
      setSuccessMsg('Settings saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.message || 'Failed to save settings. Make sure the database migration has been run.');
    } finally {
      setIsSaving(false);
    }
  };

  // Only Admin or Compliance should ideally see/edit org settings
  if (profile.role !== 'admin' && profile.role !== 'compliance') {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          Access Denied. You must be an administrator or compliance officer to view these settings.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <SettingsIcon className="text-slate-400" size={24} />
          Organization Settings
        </h1>
        <p className="text-slate-500 mt-1">
          Manage preferences and configurations for your entire organization.
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg text-sm">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-lg text-sm">
          {successMsg}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Bell size={18} className="text-slate-500" />
            Notifications
          </h2>
        </div>
        
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <label 
                htmlFor="review-emails" 
                className="text-sm font-medium text-slate-900 block mb-1"
              >
                Send Review Notification Emails
              </label>
              <p className="text-sm text-slate-500 max-w-2xl">
                When enabled, all members of your organization's compliance team will receive an email 
                notification whenever a new piece of content is submitted for review.
              </p>
            </div>
            
            <div className="ml-6 flex items-center">
              <button
                id="review-emails"
                role="switch"
                aria-checked={enableReviewEmails}
                onClick={() => setEnableReviewEmails(!enableReviewEmails)}
                className={`
                  relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                  transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2
                  ${enableReviewEmails ? 'bg-primary-600' : 'bg-slate-200'}
                `}
              >
                <span className="sr-only">Use setting</span>
                <span
                  aria-hidden="true"
                  className={`
                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                    transition duration-200 ease-in-out
                    ${enableReviewEmails ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>
        
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
