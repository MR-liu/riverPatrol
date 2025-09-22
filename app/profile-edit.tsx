import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { LoadingState } from '@/components/LoadingState';
import { PageContainer } from '@/components/PageContainer';
import { useAppContext } from '@/contexts/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserProfile {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  avatar: string;
  roleId: string;
  roleName: string;
  roleCode: string;
  departmentId: string;
  departmentName: string;
  status: string;
  lastLoginAt: string;
  createdAt: string;
  updatedAt: string;
  employeeId: string;
  position: string;
  workLocation: string;
  joinDate: string;
}

export default function ProfileEditScreen() {
  const { currentUser } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    id: '',
    username: '',
    name: '',
    phone: '',
    email: '',
    avatar: '',
    roleId: '',
    roleName: '',
    roleCode: '',
    departmentId: '',
    departmentName: '',
    status: 'active',
    lastLoginAt: '',
    createdAt: '',
    updatedAt: '',
    employeeId: '',
    position: '',
    workLocation: '',
    joinDate: '',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<UserProfile>(profile);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${apiUrl}/api/app-profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setProfile(result.data);
          setEditedProfile(result.data);
        }
      }
    } catch (error) {
      console.error('Load profile error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // 保存编辑
      handleSaveProfile();
    } else {
      // 开始编辑
      setEditedProfile(profile);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    if (!editedProfile.name.trim()) {
      Alert.alert('提示', '姓名不能为空');
      return;
    }

    if (editedProfile.phone && editedProfile.phone.trim()) {
      // 验证手机号格式
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(editedProfile.phone.trim())) {
        Alert.alert('提示', '请输入正确的手机号');
        return;
      }
    }

    if (editedProfile.email && editedProfile.email.trim()) {
      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editedProfile.email)) {
        Alert.alert('提示', '请输入正确的邮箱格式');
        return;
      }
    }

    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${apiUrl}/api/app-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editedProfile.name,
          phone: editedProfile.phone,
          email: editedProfile.email,
          avatar: editedProfile.avatar,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setProfile(result.data);
          setEditedProfile(result.data);
          setIsEditing(false);
          Alert.alert('保存成功', '个人资料已更新');
        } else {
          Alert.alert('保存失败', result.error || '个人资料保存失败，请重试');
        }
      } else {
        Alert.alert('保存失败', '个人资料保存失败，请重试');
      }
    } catch (error) {
      console.error('Save profile error:', error);
      Alert.alert('保存失败', '网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = async () => {
    Alert.alert(
      '更换头像',
      '请选择头像来源',
      [
        { text: '取消', style: 'cancel' },
        { text: '拍照', onPress: () => pickImage('camera') },
        { text: '从相册选择', onPress: () => pickImage('library') },
      ]
    );
  };

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      let result;
      
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('权限不足', '需要相机权限才能拍照');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('权限不足', '需要相册权限才能选择照片');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const newAvatar = result.assets[0].uri;
        if (isEditing) {
          setEditedProfile(prev => ({ ...prev, avatar: newAvatar }));
        } else {
          // 如果不在编辑模式，直接更新头像
          setIsLoading(true);
          try {
            const token = await AsyncStorage.getItem('authToken');
            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
            
            const response = await fetch(`${apiUrl}/api/app-profile`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                avatar: newAvatar,
              }),
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                setProfile(result.data);
                setEditedProfile(result.data);
                Alert.alert('更新成功', '头像已更新');
              }
            }
          } catch (error) {
            console.error('Update avatar error:', error);
            Alert.alert('更新失败', '头像更新失败，请重试');
          } finally {
            setIsLoading(false);
          }
        }
      }
    } catch (error) {
      Alert.alert('操作失败', '头像更新失败，请重试');
    }
  };

  const updateField = (field: keyof UserProfile, value: string) => {
    setEditedProfile(prev => ({ ...prev, [field]: value }));
  };

  const renderField = (
    label: string,
    field: keyof UserProfile,
    placeholder: string,
    editable: boolean = true,
    keyboardType: any = 'default',
    multiline: boolean = false
  ) => {
    const value = isEditing ? editedProfile[field] : profile[field];
    const isReadOnly = !isEditing || !editable;
    
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={[
            styles.fieldInput,
            isReadOnly && styles.fieldInputReadonly,
            multiline && styles.fieldInputMultiline,
          ]}
          value={value}
          placeholder={placeholder}
          editable={!isReadOnly}
          onChangeText={(text) => !isReadOnly && updateField(field, text)}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
        {!editable && (
          <Text style={styles.fieldNote}>此信息由管理员维护</Text>
        )}
      </View>
    );
  };

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const currentProfile = isEditing ? editedProfile : profile;

  return (
    <PageContainer 
      title="个人资料"
      rightButton={{
        icon: isEditing ? 'close' : 'edit',
        onPress: isEditing ? handleCancelEdit : handleEditToggle
      }}
    >
      <LoadingState isLoading={isLoading}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* 头像区域 */}
            <View style={styles.avatarSection}>
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={handleAvatarChange}
              >
                {currentProfile.avatar ? (
                  <Image source={{ uri: currentProfile.avatar }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <MaterialIcons name="person" size={48} color="#9CA3AF" />
                  </View>
                )}
                <View style={styles.avatarOverlay}>
                  <MaterialIcons name="camera-alt" size={20} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              <Text style={styles.avatarHint}>点击更换头像</Text>
            </View>

            {/* 基本信息 */}
            {renderSection('基本信息', (
              <>
                {renderField('姓名', 'name', '请输入姓名')}
                {renderField('工号', 'employeeId', '工号', false)}
                {renderField('职位', 'position', '职位', false)}
                {renderField('部门', 'departmentName', '部门', false)}
                {renderField('入职日期', 'joinDate', '入职日期', false)}
              </>
            ))}

            {/* 联系信息 */}
            {renderSection('联系信息', (
              <>
                {renderField('手机号', 'phone', '请输入手机号', true, 'phone-pad')}
                {renderField('邮箱', 'email', '请输入邮箱', true, 'email-address')}
                {renderField('工作地点', 'workLocation', '工作地点', false)}
              </>
            ))}

            {/* 账号信息 */}
            {renderSection('账号信息', (
              <>
                {renderField('用户名', 'username', '用户名', false)}
                {renderField('角色', 'roleName', '角色', false)}
                {renderField('状态', 'status', '状态', false)}
              </>
            ))}

            {/* 操作按钮 */}
            {isEditing && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={handleCancelEdit}
                >
                  <Text style={styles.cancelButtonText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={handleSaveProfile}
                >
                  <Text style={styles.saveButtonText}>保存</Text>
                </TouchableOpacity>
              </View>
            )}

            {!isEditing && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEditToggle}
              >
                <MaterialIcons name="edit" size={20} color="#FFFFFF" />
                <Text style={styles.editButtonText}>编辑资料</Text>
              </TouchableOpacity>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </LoadingState>
      </PageContainer>
    );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  avatarOverlay: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarHint: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  fieldInputReadonly: {
    backgroundColor: '#F9FAFB',
    color: '#6B7280',
  },
  fieldInputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  fieldNote: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
    marginVertical: 20,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomSpacer: {
    height: 20,
  },
});