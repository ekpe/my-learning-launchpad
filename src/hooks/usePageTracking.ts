import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { logEvent, AnalyticsEvent } from '../services/analyticsService';

export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    logEvent(AnalyticsEvent.PAGE_VIEW, {
      path: location.pathname,
      search: location.search,
    });
  }, [location]);
};
