import React, { ReactElement } from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { ENV } from '../../config/env';

interface Props {
    children: ReactElement | ReactElement[];
}

export const StripeProviderWrapper: React.FC<Props> = ({ children }) => {
    return (
        <StripeProvider
            publishableKey={ENV.STRIPE_PUBLISHABLE_KEY || 'pk_test_sample'}
            merchantIdentifier="merchant.com.atsresumeoptimizer"
        >
            {children}
        </StripeProvider>
    );
};
