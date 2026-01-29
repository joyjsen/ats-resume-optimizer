import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Text, useTheme, ActivityIndicator, Card, Button, Divider, List, Chip } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { userService } from '../../../src/services/firebase/userService';
import { activityService } from '../../../src/services/firebase/activityService';
import { historyService } from '../../../src/services/firebase/historyService';
import { UserProfile, UserActivity, ACTIVITY_COSTS } from '../../../src/types/profile.types';
import { SavedAnalysis } from '../../../src/types/history.types';
import { ProfileHeader } from '../../../src/components/profile/ProfileHeader';
import { TokenCard } from '../../../src/components/profile/TokenCard';
import { useResumeStore } from '../../../src/store/resumeStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';

export default function AdminUserDetailScreen() {
    const { uid } = useLocalSearchParams<{ uid: string }>();
    const theme = useTheme();
    const router = useRouter();
    const { setCurrentAnalysis } = useResumeStore();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [activities, setActivities] = useState<UserActivity[]>([]);
    const [history, setHistory] = useState<SavedAnalysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyExpanded, setHistoryExpanded] = useState(false);
    const [activityExpanded, setActivityExpanded] = useState(false);
    const [tokenBreakdownVisible, setTokenBreakdownVisible] = useState(false);

    // Calculate token usage breakdown by activity type
    const tokenBreakdown = useMemo(() => {
        const breakdown: Record<string, { count: number; tokens: number }> = {};

        activities.forEach(activity => {
            const type = activity.type;
            if (!breakdown[type]) {
                breakdown[type] = { count: 0, tokens: 0 };
            }
            breakdown[type].count++;
            breakdown[type].tokens += activity.tokensUsed || 0;
        });

        // Sort by tokens used (descending)
        return Object.entries(breakdown)
            .sort((a, b) => b[1].tokens - a[1].tokens)
            .map(([type, data]) => ({
                type,
                ...data,
                costPerAction: ACTIVITY_COSTS[type as keyof typeof ACTIVITY_COSTS] || 0
            }));
    }, [activities]);

    useEffect(() => {
        if (uid) loadUserData();
    }, [uid]);

    const loadUserData = async () => {
        setLoading(true);
        try {
            const [userProfile, userActivities, userHistory] = await Promise.all([
                userService.getUserProfile(uid as string),
                activityService.getUserActivitiesAdmin(uid as string),
                historyService.getUserHistoryByUid(uid as string)
            ]);
            setProfile(userProfile);
            setActivities(userActivities);
            setHistory(userHistory);
        } catch (error) {
            console.error("Failed to load user data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleGrantTokens = () => {
        Alert.alert(
            "Grant Tokens",
            "Select amount to add to user's balance:",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "+50 Tokens", onPress: () => processGrant(50)
                },
                {
                    text: "+100 Tokens", onPress: () => processGrant(100)
                },
                {
                    text: "+500 Tokens", onPress: () => processGrant(500)
                }
            ]
        );
    };

    const processGrant = async (amount: number) => {
        if (!profile) return;
        setLoading(true);
        try {
            // 1. Credit Tokens
            await userService.creditTokens(profile.uid, amount);

            // 2. Log Activity (for Notification)
            // Note: We cast 'admin_adjustment' to ActivityType if it's not strictly in the enum yet, 
            // or ensure it's added to types. Assuming it is or using 'any' cast if needed for now.
            await activityService.logActivity({
                type: 'admin_adjustment' as any,
                description: `Admin granted ${amount} tokens`,
                targetUserId: profile.uid,
                contextData: { amount, cost: 0.00 }
            });

            Alert.alert("Success", `Granted ${amount} tokens.`);
            loadUserData();
        } catch (error) {
            console.error("Grant Error", error);
            Alert.alert("Error", "Failed to grant tokens.");
        } finally {
            setLoading(false);
        }
    };

    const formatActivityType = (type: string) => {
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const getActivityColor = (type: string): string => {
        const colors: Record<string, string> = {
            'resume_parsing': '#FF9800',
            'job_extraction': '#2196F3',
            'gap_analysis': '#E91E63',
            'ats_score_calculation': '#00BCD4',
            'bullet_enhancement': '#FF5722',
            'skill_incorporation': '#795548',
            'resume_optimized': '#4CAF50',
            'resume_reoptimization': '#8BC34A',
            'cover_letter_generation': '#9C27B0',
            'company_research': '#3F51B5',
            'interview_prep_generation': '#673AB7',
            'training_slideshow_generation': '#607D8B',
            'concept_explanation': '#009688',
            'token_purchase': '#4CAF50',
        };
        return colors[type] || '#757575';
    };

    const getActivityIcon = (type: string): string => {
        const icons: Record<string, string> = {
            'resume_parsing': 'file-document-outline',
            'job_extraction': 'briefcase-outline',
            'gap_analysis': 'chart-bar',
            'ats_score_calculation': 'percent',
            'bullet_enhancement': 'format-list-bulleted',
            'skill_incorporation': 'plus-circle-outline',
            'resume_optimized': 'check-circle-outline',
            'resume_reoptimization': 'refresh',
            'cover_letter_generation': 'email-outline',
            'company_research': 'domain',
            'interview_prep_generation': 'account-question',
            'training_slideshow_generation': 'presentation',
            'concept_explanation': 'lightbulb-outline',
            'skill_marked_learned': 'school-outline',
            'token_purchase': 'credit-card-outline',
            'pdf_export': 'file-pdf-box',
        };
        return icons[type] || 'circle-outline';
    };

    const handleSuspendAccount = async () => {
        if (!profile) return;
        const newStatus = profile.accountStatus === 'active' ? 'suspended' : 'active';
        try {
            await userService.updateProfile(profile.uid, { accountStatus: newStatus });
            loadUserData();
            Alert.alert("Success", `Account ${newStatus} successfully.`);
        } catch (error) {
            Alert.alert("Error", "Failed to update account status.");
        }
    };

    if (loading) return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
    if (!profile) return <View style={styles.centered}><Text>User not found.</Text></View>;

    return (
        <ScrollView style={styles.container}>
            <ProfileHeader profile={profile} onEdit={() => { }} />

            <TokenCard
                balance={profile.tokenBalance}
                totalPurchased={profile.totalTokensPurchased}
                totalUsed={profile.totalTokensUsed}
                onPurchase={handleGrantTokens} // Admin "Grants" instead of purchases
                onViewAnalytics={() => setTokenBreakdownVisible(true)}
            />

            {/* Token Usage Breakdown Modal */}
            <Modal
                visible={tokenBreakdownVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setTokenBreakdownVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setTokenBreakdownVisible(false)}
                >
                    <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
                        <View style={styles.modalHeader}>
                            <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>Token Usage Breakdown</Text>
                            <TouchableOpacity onPress={() => setTokenBreakdownVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {/* Summary */}
                        <View style={styles.tokenSummary}>
                            <View style={styles.tokenSummaryItem}>
                                <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: '#4CAF50' }}>
                                    {profile.tokenBalance}
                                </Text>
                                <Text variant="labelSmall" style={{ color: '#666' }}>Available</Text>
                            </View>
                            <View style={styles.tokenSummaryDivider} />
                            <View style={styles.tokenSummaryItem}>
                                <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: '#F44336' }}>
                                    {profile.totalTokensUsed}
                                </Text>
                                <Text variant="labelSmall" style={{ color: '#666' }}>Total Used</Text>
                            </View>
                            <View style={styles.tokenSummaryDivider} />
                            <View style={styles.tokenSummaryItem}>
                                <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: '#2196F3' }}>
                                    {profile.totalTokensPurchased}
                                </Text>
                                <Text variant="labelSmall" style={{ color: '#666' }}>Purchased</Text>
                            </View>
                        </View>

                        <Divider style={{ marginVertical: 16 }} />

                        <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 12 }}>
                            Usage by Activity Type
                        </Text>

                        <ScrollView style={styles.breakdownScroll}>
                            {tokenBreakdown.length > 0 ? (
                                tokenBreakdown.map((item, index) => (
                                    <View key={item.type} style={styles.breakdownItem}>
                                        <View style={styles.breakdownLeft}>
                                            <View style={[styles.breakdownDot, { backgroundColor: getActivityColor(item.type) }]} />
                                            <View style={{ flex: 1 }}>
                                                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                                                    {formatActivityType(item.type)}
                                                </Text>
                                                <Text variant="labelSmall" style={{ color: '#888' }}>
                                                    {item.count} {item.count === 1 ? 'time' : 'times'} • {item.costPerAction} tokens each
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.breakdownRight}>
                                            <View style={styles.tokenBadgeLarge}>
                                                <MaterialCommunityIcons name="fire" size={16} color="#D32F2F" />
                                                <Text style={styles.tokenBadgeLargeText}>{item.tokens}</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <View style={styles.emptyBreakdown}>
                                    <MaterialCommunityIcons name="chart-box-outline" size={48} color="#ccc" />
                                    <Text variant="bodyMedium" style={{ color: '#888', marginTop: 12 }}>
                                        No token usage recorded yet
                                    </Text>
                                </View>
                            )}
                        </ScrollView>

                        <Button
                            mode="contained"
                            onPress={() => setTokenBreakdownVisible(false)}
                            style={{ marginTop: 16 }}
                        >
                            Close
                        </Button>
                    </Pressable>
                </Pressable>
            </Modal>

            <View style={styles.adminActions}>
                <Text variant="titleMedium" style={styles.sectionTitle}>Admin Actions</Text>
                <View style={styles.actionRow}>
                    <Button
                        mode="contained"
                        onPress={handleGrantTokens}
                        style={styles.actionButton}
                        icon="plus-circle"
                    >
                        Grant Tokens
                    </Button>
                    <Button
                        mode="outlined"
                        onPress={handleSuspendAccount}
                        style={styles.actionButton}
                        textColor={profile.accountStatus === 'active' ? theme.colors.error : theme.colors.primary}
                        icon={profile.accountStatus === 'active' ? 'account-off' : 'account-check'}
                    >
                        {profile.accountStatus === 'active' ? 'Suspend' : 'Activate'}
                    </Button>
                </View>

                <View style={styles.actionRow}>
                    <Button
                        mode="outlined"
                        onPress={async () => {
                            const newRole = profile.role === 'admin' ? 'user' : 'admin';
                            try {
                                await userService.updateProfile(profile.uid, { role: newRole });
                                loadUserData();
                                Alert.alert("Success", `User role updated to ${newRole}.`);
                            } catch (e) {
                                Alert.alert("Error", "Failed to update role.");
                            }
                        }}
                        style={styles.actionButton}
                        icon={profile.role === 'admin' ? 'account-minus' : 'account-plus'}
                    >
                        {profile.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                    </Button>
                    <Button
                        mode="text"
                        onPress={() => Alert.alert("GDPR", "Exporting user data...")}
                        style={styles.actionButton}
                        icon="export"
                    >
                        Export Data
                    </Button>
                </View>
            </View>

            <Divider style={{ marginVertical: 16 }} />

            {/* Analysis History - Collapsible */}
            <View style={styles.collapsibleSection}>
                <TouchableOpacity
                    style={styles.collapsibleHeader}
                    onPress={() => setHistoryExpanded(!historyExpanded)}
                    activeOpacity={0.7}
                >
                    <View style={styles.collapsibleTitleRow}>
                        <MaterialCommunityIcons
                            name={historyExpanded ? 'chevron-down' : 'chevron-right'}
                            size={24}
                            color="#666"
                        />
                        <Text variant="titleMedium" style={styles.collapsibleTitle}>
                            Analysis History
                        </Text>
                    </View>
                    <Chip style={styles.countChip} textStyle={{ fontSize: 12 }}>
                        {history.length}
                    </Chip>
                </TouchableOpacity>

                {historyExpanded && (
                    <View style={styles.collapsibleContent}>
                        {history.length > 0 ? (
                            history.map(item => (
                                <List.Item
                                    key={item.id}
                                    title={item.jobTitle}
                                    description={`${item.company} • Score: ${item.atsScore}`}
                                    left={props => <List.Icon {...props} icon="file-document-outline" />}
                                    right={props => <List.Icon {...props} icon="chevron-right" />}
                                    onPress={() => {
                                        // Set the analysis data first
                                        setCurrentAnalysis({
                                            ...item.analysisData,
                                            id: item.id,
                                            job: item.jobData,
                                            resume: item.resumeData || {} as any,
                                            optimizedResume: item.optimizedResumeData,
                                            changes: item.changesData,
                                            draftOptimizedResumeData: item.draftOptimizedResumeData,
                                            draftChangesData: item.draftChangesData,
                                            draftAtsScore: item.draftAtsScore,
                                            draftMatchAnalysis: item.draftMatchAnalysis,
                                        });
                                        // Navigate to admin-specific analysis view (stays in admin Stack)
                                        router.push('/admin/analysis-view');
                                    }}
                                    style={styles.listItem}
                                />
                            ))
                        ) : (
                            <Text variant="bodyMedium" style={styles.emptyText}>
                                No analysis history found for this user.
                            </Text>
                        )}
                    </View>
                )}
            </View>

            <Divider style={{ marginVertical: 16 }} />

            {/* Recent Activity - Collapsible */}
            <View style={styles.collapsibleSection}>
                <TouchableOpacity
                    style={styles.collapsibleHeader}
                    onPress={() => setActivityExpanded(!activityExpanded)}
                    activeOpacity={0.7}
                >
                    <View style={styles.collapsibleTitleRow}>
                        <MaterialCommunityIcons
                            name={activityExpanded ? 'chevron-down' : 'chevron-right'}
                            size={24}
                            color="#666"
                        />
                        <Text variant="titleMedium" style={styles.collapsibleTitle}>
                            Recent Activity
                        </Text>
                    </View>
                    <Chip style={styles.countChip} textStyle={{ fontSize: 12 }}>
                        {activities.length}
                    </Chip>
                </TouchableOpacity>

                {activityExpanded && (
                    <View style={styles.collapsibleContent}>
                        {activities.length > 0 ? (
                            activities.map(item => (
                                <View key={item.activityId} style={styles.activityItem}>
                                    <View style={styles.activityIcon}>
                                        <MaterialCommunityIcons
                                            name={getActivityIcon(item.type) as any}
                                            size={20}
                                            color={theme.colors.primary}
                                        />
                                    </View>
                                    <View style={styles.activityContent}>
                                        <Text variant="bodyMedium" style={styles.activityDescription}>
                                            {item.description}
                                        </Text>
                                        <View style={styles.activityMeta}>
                                            <Text variant="labelSmall" style={styles.activityTime}>
                                                {format(item.timestamp, 'MMM d, yyyy HH:mm')}
                                            </Text>
                                            {item.tokensUsed > 0 && (
                                                <View style={styles.tokenBadge}>
                                                    <MaterialCommunityIcons name="fire" size={12} color="#D32F2F" />
                                                    <Text style={styles.tokenBadgeText}>{item.tokensUsed}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <Text variant="bodyMedium" style={styles.emptyText}>
                                No activity found for this user.
                            </Text>
                        )}
                    </View>
                )}
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    adminActions: {
        padding: 16,
    },
    sectionTitle: {
        fontWeight: 'bold',
        marginBottom: 12,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 8,
    },
    actionButton: {
        flex: 1,
    },
    collapsibleSection: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        borderRadius: 8,
        overflow: 'hidden',
    },
    collapsibleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    collapsibleTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    collapsibleTitle: {
        fontWeight: 'bold',
        marginLeft: 8,
    },
    countChip: {
        backgroundColor: '#e3f2fd',
    },
    collapsibleContent: {
        paddingHorizontal: 8,
        paddingBottom: 8,
    },
    listItem: {
        backgroundColor: '#fafafa',
        marginBottom: 4,
        borderRadius: 4,
    },
    emptyText: {
        fontStyle: 'italic',
        opacity: 0.6,
        padding: 16,
        textAlign: 'center',
    },
    activityItem: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: '#fafafa',
        marginBottom: 4,
        borderRadius: 4,
    },
    activityIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#e3f2fd',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    activityContent: {
        flex: 1,
    },
    activityDescription: {
        color: '#212121',
        marginBottom: 4,
    },
    activityMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    activityTime: {
        color: '#888',
    },
    tokenBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffebee',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 2,
    },
    tokenBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#D32F2F',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    tokenSummary: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
        padding: 16,
    },
    tokenSummaryItem: {
        alignItems: 'center',
    },
    tokenSummaryDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#ddd',
    },
    breakdownScroll: {
        maxHeight: 300,
    },
    breakdownItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    breakdownLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    breakdownDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    breakdownRight: {
        alignItems: 'flex-end',
    },
    tokenBadgeLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffebee',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 4,
    },
    tokenBadgeLargeText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#D32F2F',
    },
    emptyBreakdown: {
        alignItems: 'center',
        padding: 40,
    },
});
