import React from 'react';
import { View, Platform } from 'react-native';
import { WebSidebar } from './WebSidebar';
import { webStyles } from '../../styles/web.styles';

interface Props {
    children: React.ReactNode;
}

export const WebAppLayout: React.FC<Props> = ({ children }) => {
    if (Platform.OS !== 'web') {
        return <>{children}</>;
    }

    return (
        <View style={webStyles.appLayoutContainer}>
            <WebSidebar />
            <View style={webStyles.mainContent}>{children}</View>
        </View>
    );
};
