// Edu CRM — Mongoose sxemalari (MongoDB uchun, Prisma o'rniga)
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

// Har bir hujjat JSON'ga aylantirilganda _id -> id, __v olib tashlanadi
// (Mongoose "id" virtual getterini standart holda o'zi yaratadi).
const jsonTransform = {
  virtuals: true,
  versionKey: false,
  transform: (_doc: any, ret: any) => {
    delete ret._id;
    return ret;
  },
};
const schemaOptions = { timestamps: true, toJSON: jsonTransform, toObject: jsonTransform };

// ---------- User (admin/o'qituvchi login) ----------
@Schema(schemaOptions)
export class User extends Document {
  @Prop({ required: true }) name: string;
  @Prop({ required: true, unique: true }) phone: string;
  @Prop({ required: true }) password: string;
  @Prop({ enum: ['SUPERADMIN', 'ADMIN', 'RAHBAR', 'TEACHER'], default: 'ADMIN' }) role: string;
  @Prop() teacherId?: string;
  @Prop() avatarUrl?: string;
  // Admin/superadmin ko'rishi uchun saqlanadigan ochiq matnli parol nusxasi (parol tiklash/ko'rsatish uchun).
  // Haqiqiy autentifikatsiya hamon yuqoridagi hash qilingan 'password' orqali ishlaydi.
  @Prop() plainPassword?: string;
}
export const UserSchema = SchemaFactory.createForClass(User);

// ---------- Teacher ----------
// O'qituvchining hujjatlari (diplom, sertifikat, malaka kursi va h.k.) — ichki sub-hujjat sifatida saqlanadi.
const TeacherDocumentSchema = new MongooseSchema(
  {
    title: { type: String, required: true },
    type: {
      type: String,
      enum: ['DIPLOM', 'SERTIFIKAT', 'MALAKA_KURSI', 'BOSHQA'],
      default: 'BOSHQA',
    },
    fileUrl: { type: String, required: true },
    fileName: { type: String },
    fileSize: { type: Number },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: true },
);

@Schema(schemaOptions)
export class Teacher extends Document {
  @Prop({ required: true }) fullName: string;
  @Prop({ required: true }) phone: string;
  @Prop() subject?: string;
  @Prop() salaryPct?: number;
  @Prop({ default: true }) active: boolean;
  @Prop({ type: [TeacherDocumentSchema], default: [] }) documents: Array<{
    _id: any;
    title: string;
    type: string;
    fileUrl: string;
    fileName?: string;
    fileSize?: number;
    uploadedAt: Date;
  }>;
}
export const TeacherSchema = SchemaFactory.createForClass(Teacher);

// ---------- Group ----------
@Schema(schemaOptions)
export class Group extends Document {
  @Prop({ required: true }) name: string;
  @Prop() subject?: string;
  @Prop({ required: true }) price: number;
  @Prop({ default: 20 }) capacity: number;
  @Prop({ required: true }) teacherId: string;
  // Bitta o'qituvchi bir nechta fan/guruhda dars berishi va har birida maoshi turlicha
  // bo'lishi mumkin (masalan matematikadan 40%, IT'dan 50%) — shu sababli maosh foizi
  // avvalo shu guruh darajasida belgilanadi. Bo'sh qoldirilsa, o'qituvchining standart
  // (Teacher.salaryPct) foizi ishlatiladi.
  @Prop() salaryPct?: number;
  @Prop() room?: string;
  @Prop({ default: true }) active: boolean;
  @Prop({ type: [String], default: [] }) studentIds: string[];
}
export const GroupSchema = SchemaFactory.createForClass(Group);

// ---------- Student ----------
@Schema(schemaOptions)
export class Student extends Document {
  @Prop({ required: true }) fullName: string;
  @Prop() phone?: string;
  @Prop() parentName?: string;
  @Prop() parentPhone?: string;
  @Prop() birthDate?: Date;
  @Prop() address?: string;
  @Prop({ default: true }) active: boolean;
  @Prop({ type: [String], default: [] }) groupIds: string[];
  // O'tgan oyda shu guruhdagi eng top 5 o'quvchi ichiga kirgani uchun avtomatik chegirma (%).
  // Har oyning 1-kunida DiscountsService tomonidan qayta hisoblanadi.
  @Prop({ default: 0 }) discountPct: number;
}
export const StudentSchema = SchemaFactory.createForClass(Student);

// ---------- ScheduleSlot (haftalik takrorlanuvchi jadval) ----------
@Schema({ timestamps: true, toJSON: jsonTransform, toObject: jsonTransform })
export class ScheduleSlot extends Document {
  @Prop({ required: true }) groupId: string;
  @Prop({ required: true }) dayOfWeek: number;
  @Prop({ required: true }) startTime: string;
  @Prop({ required: true }) endTime: string;
  @Prop() room?: string;
}
export const ScheduleSlotSchema = SchemaFactory.createForClass(ScheduleSlot);

// ---------- Lesson (aniq sanadagi dars) ----------
@Schema(schemaOptions)
export class Lesson extends Document {
  @Prop({ required: true }) groupId: string;
  @Prop({ required: true }) date: Date;
  @Prop({ required: true }) startTime: string;
  @Prop({ required: true }) endTime: string;
  @Prop({ enum: ['PLANNED', 'COMPLETED', 'CANCELLED'], default: 'PLANNED' }) status: string;
  @Prop() topic?: string;
}
export const LessonSchema = SchemaFactory.createForClass(Lesson);

// ---------- Homework (uyga vazifa) — fayl yoki video havolasi bilan ----------
@Schema(schemaOptions)
export class Homework extends Document {
  @Prop({ required: true }) groupId: string;
  @Prop({ required: true }) teacherId: string;
  @Prop({ required: true }) title: string;
  @Prop() description?: string;
  @Prop() fileUrl?: string;
  @Prop() fileName?: string;
  @Prop() videoUrl?: string;
  @Prop() dueDate?: Date;
}
export const HomeworkSchema = SchemaFactory.createForClass(Homework);

// ---------- Grade (baho) ----------
@Schema({ timestamps: { createdAt: true, updatedAt: false }, toJSON: jsonTransform, toObject: jsonTransform })
export class Grade extends Document {
  @Prop({ required: true }) studentId: string;
  @Prop({ required: true }) groupId: string;
  @Prop({ required: true }) teacherId: string;
  @Prop() lessonId?: string;
  @Prop({ required: true, min: 1, max: 10 }) score: number;
  @Prop() comment?: string;
  createdAt?: Date;
}
export const GradeSchema = SchemaFactory.createForClass(Grade);

// ---------- Feedback (o'quvchi/ota-ona tomonidan o'qituvchiga har kunlik fikr-mulohaza) ----------
@Schema({ timestamps: { createdAt: true, updatedAt: false }, toJSON: jsonTransform, toObject: jsonTransform })
export class Feedback extends Document {
  @Prop({ required: true }) studentId: string;
  @Prop({ required: true }) teacherId: string;
  @Prop({ required: true }) groupId: string;
  @Prop() lessonId?: string;
  @Prop({ required: true, enum: ['POSITIVE', 'NEGATIVE'] }) sentiment: string;
  @Prop() comment?: string;
  createdAt?: Date;
}
export const FeedbackSchema = SchemaFactory.createForClass(Feedback);

// ---------- Attendance ----------
@Schema({ timestamps: false, toJSON: jsonTransform, toObject: jsonTransform })
export class Attendance extends Document {
  @Prop({ required: true }) lessonId: string;
  @Prop({ required: true }) studentId: string;
  @Prop({ enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'], default: 'PRESENT' }) status: string;
  @Prop() note?: string;
  // Kechikkanda necha minut kechikkani (faqat status === 'LATE' bo'lganda mazmunli).
  @Prop() lateMinutes?: number;
  @Prop({ default: () => new Date() }) markedAt: Date;
}
export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
AttendanceSchema.index({ lessonId: 1, studentId: 1 }, { unique: true });

// ---------- Payment ----------
@Schema({ timestamps: { createdAt: true, updatedAt: false }, toJSON: jsonTransform, toObject: jsonTransform })
export class Payment extends Document {
  @Prop({ required: true }) studentId: string;
  @Prop({ required: true }) amount: number;
  @Prop({ enum: ['CASH', 'CARD', 'PAYME', 'CLICK', 'OTHER'], default: 'CASH' }) method: string;
  @Prop({ required: true }) periodMonth: string;
  @Prop() note?: string;
  createdAt?: Date;
}
export const PaymentSchema = SchemaFactory.createForClass(Payment);

// ---------- ParentLink ----------
@Schema({ timestamps: { createdAt: true, updatedAt: false }, toJSON: jsonTransform, toObject: jsonTransform })
export class ParentLink extends Document {
  @Prop({ required: true }) studentId: string;
  @Prop() chatId?: string;
  @Prop({ required: true, unique: true }) linkCode: string;
  @Prop() linkedAt?: Date;
}
export const ParentLinkSchema = SchemaFactory.createForClass(ParentLink);

// ---------- TeacherLink ----------
@Schema({ timestamps: { createdAt: true, updatedAt: false }, toJSON: jsonTransform, toObject: jsonTransform })
export class TeacherLink extends Document {
  @Prop({ required: true }) teacherId: string;
  @Prop() chatId?: string;
  @Prop({ required: true, unique: true }) linkCode: string;
  @Prop() linkedAt?: Date;
}
export const TeacherLinkSchema = SchemaFactory.createForClass(TeacherLink);

// ---------- TeacherAttendance (kelish/ketish + joylashuv) ----------
@Schema({ timestamps: false, toJSON: jsonTransform, toObject: jsonTransform })
export class TeacherAttendance extends Document {
  @Prop({ required: true }) teacherId: string;
  @Prop({ enum: ['CHECK_IN', 'CHECK_OUT'], required: true }) type: string;
  @Prop({ required: true }) latitude: number;
  @Prop({ required: true }) longitude: number;
  @Prop({ default: () => new Date() }) capturedAt: Date;
}
export const TeacherAttendanceSchema = SchemaFactory.createForClass(TeacherAttendance);

// ---------- TeacherLiveLocation ----------
@Schema({ timestamps: { createdAt: false, updatedAt: true }, toJSON: jsonTransform, toObject: jsonTransform })
export class TeacherLiveLocation extends Document {
  @Prop({ required: true, unique: true }) teacherId: string;
  @Prop({ required: true }) latitude: number;
  @Prop({ required: true }) longitude: number;
  @Prop({ default: true }) active: boolean;
  updatedAt?: Date;
}
export const TeacherLiveLocationSchema = SchemaFactory.createForClass(TeacherLiveLocation);

// ---------- LeaveRequest (ariza) ----------
@Schema({ timestamps: { createdAt: true, updatedAt: false }, toJSON: jsonTransform, toObject: jsonTransform })
export class LeaveRequest extends Document {
  @Prop({ required: true }) teacherId: string;
  @Prop({ required: true }) reason: string;
  @Prop({ enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' }) status: string;
  @Prop() decidedAt?: Date;
  @Prop() decidedNote?: string;
  createdAt?: Date;
}
export const LeaveRequestSchema = SchemaFactory.createForClass(LeaveRequest);

// ---------- StudentLeaveRequest (ota-ona arizasi — farzandi haqida) ----------
@Schema({ timestamps: { createdAt: true, updatedAt: false }, toJSON: jsonTransform, toObject: jsonTransform })
export class StudentLeaveRequest extends Document {
  @Prop({ required: true }) studentId: string;
  @Prop({ required: true }) reason: string;
  @Prop({ enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' }) status: string;
  @Prop() decidedAt?: Date;
  @Prop() decidedNote?: string;
  createdAt?: Date;
}
export const StudentLeaveRequestSchema = SchemaFactory.createForClass(StudentLeaveRequest);

// ---------- NotificationLog ----------
@Schema({ timestamps: { createdAt: true, updatedAt: false }, toJSON: jsonTransform, toObject: jsonTransform })
export class NotificationLog extends Document {
  @Prop() studentId?: string;
  @Prop() teacherId?: string;
  @Prop({ required: true }) chatId: string;
  @Prop({ required: true }) type: string;
  @Prop({ required: true }) message: string;
  @Prop({ default: true }) success: boolean;
  createdAt?: Date;
}
export const NotificationLogSchema = SchemaFactory.createForClass(NotificationLog);
