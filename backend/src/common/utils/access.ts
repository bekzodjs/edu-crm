import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { Group } from '../../database/schemas';

export interface AuthUser {
  userId: string;
  role: string;
  teacherId?: string;
}

/** TEACHER rolida bo'lsa uning teacherId'si, aks holda undefined (cheklov yo'q). */
export function teacherScope(user: AuthUser): string | undefined {
  if (user?.role !== 'TEACHER') return undefined;
  // teacherId biriktirilmagan o'qituvchi hisobi hech narsani ko'rmasligi kerak.
  return user.teacherId || '__none__';
}

/** O'qituvchiga tegishli guruh ID'lari. */
export async function teacherGroupIds(groupModel: Model<Group>, teacherId: string): Promise<string[]> {
  const groups = await groupModel.find({ teacherId }).select('_id');
  return groups.map((g) => g.id);
}

/** O'qituvchi guruhlaridagi barcha o'quvchilar ID'lari. */
export async function teacherStudentIds(groupModel: Model<Group>, teacherId: string): Promise<Set<string>> {
  const groups = await groupModel.find({ teacherId }).select('studentIds');
  const ids = new Set<string>();
  for (const g of groups) for (const s of g.studentIds) ids.add(s);
  return ids;
}

/**
 * Guruhni topadi va (agar foydalanuvchi TEACHER bo'lsa) u shu guruhning o'qituvchisi
 * ekanini tekshiradi.
 */
export async function loadGroupForUser(groupModel: Model<Group>, groupId: string, user?: AuthUser) {
  const group = await groupModel.findById(groupId);
  if (!group) throw new NotFoundException('Guruh topilmadi');
  const scope = user ? teacherScope(user) : undefined;
  if (scope && group.teacherId !== scope) {
    throw new ForbiddenException("Faqat o'zingizning guruhingiz bilan ishlashingiz mumkin");
  }
  return group;
}

/** TEACHER faqat o'z guruhlaridagi o'quvchi ma'lumotlarini ko'ra oladi. */
export async function assertStudentVisible(groupModel: Model<Group>, studentId: string, user: AuthUser) {
  const scope = teacherScope(user);
  if (!scope) return;
  const ids = await teacherStudentIds(groupModel, scope);
  if (!ids.has(studentId)) {
    throw new ForbiddenException("Faqat o'zingizning guruhingizdagi o'quvchilarni ko'rishingiz mumkin");
  }
}
