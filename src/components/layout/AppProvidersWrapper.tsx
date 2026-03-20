import React from 'react';
import { StripeProviderWrapper } from '../providers/StripeProviderWrapper';
import { TaskQueueProvider } from '../../context/TaskQueueContext';

/**
 * AppProvidersWrapper bundles heavy providers that shouldn't load on the landing page.
 */
export const AppProvidersWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <StripeProviderWrapper>
            <TaskQueueProvider>
                {children}
            </TaskQueueProvider>
        </StripeProviderWrapper>
    );
};

export default AppProvidersWrapper;
