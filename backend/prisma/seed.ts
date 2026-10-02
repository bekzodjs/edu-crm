// Demo ma'lumot bilan bazani to'ldirish skripti (yetarlicha katta, lekin tezroq ishlashi uchun
// og'ir qismlari parallel bajariladi). Ishga tushirish: npm run seed
import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import {
  UserSchema,
  TeacherSchema,
  GroupSchema,
  StudentSchema,
  ScheduleSlotSchema,
  LessonSchema,
  AttendanceSchema,
  PaymentSchema,
  TeacherLinkSchema,
  LeaveRequestSchema,
} from '../src/database/schemas';

const User = mongoose.model('User', UserSchema);
const Teacher = mongoose.model('Teacher', TeacherSchema);
const Group = mongoose.model('Group', GroupSchema);
const Student = mongoose.model('Student', StudentSchema);
const ScheduleSlot = mongoose.model('ScheduleSlot', ScheduleSlotSchema);
const Lesson = mongoose.model('Lesson', LessonSchema);
const Attendance = mongoose.model('Attendance', AttendanceSchema);
const Payment = mongoose.model('Payment', PaymentSchema);
const TeacherLink = mongoose.model('TeacherLink', TeacherLinkSchema);
const LeaveRequest = mongoose.model('LeaveRequest', LeaveRequestSchema);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickSome<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < count && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function periodOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
async function inChunks<T>(items: T[], size: number, fn: (item: T) => Promise<any>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

const MALE_NAMES = ['Abdulla', 'Bekzod', 'Sardor', 'Jasur', 'Otabek', 'Sherzod', 'Farrux', 'Nodir', 'Ulug\'bek', 'Islom', 'Diyorbek', 'Aziz', 'Sanjar', 'Rustam', 'Bobur', 'Akmal', 'Davron', 'Elyor', 'Jahongir', 'Xurshid'];
const FEMALE_NAMES = ['Dilnoza', 'Malika', 'Sevinch', 'Gulnora', 'Zarina', 'Nigora', 'Madina', 'Shahnoza', 'Feruza', 'Kamola', 'Oysha', 'Muxlisa', 'Yulduz', 'Sabina', 'Nozima', 'Robiya', 'Lobar', 'Gulbahor', 'Marjona', 'Ozoda'];
const SURNAMES = ['Karimov', 'Rashidov', 'Yusupov', 'Tashkentov', 'Ergashev', 'Nazarov', 'Xolmatov', 'Saidov', 'Umarov', 'Rahimov', 'Abdullayev', 'Sultonov', 'Mirzayev', 'Toshpo\'latov', 'Qodirov', 'Ismoilov', 'Jo\'rayev', 'Xoliqov', 'Fayzullayev', 'Ne\'matov'];
const ADDRESSES = ['Yunusobod', 'Chilonzor', 'Mirzo Ulug\'bek', 'Yakkasaroy', 'Sergeli', 'Shayxontohur', 'Olmazor', 'Bektemir'];
const SUBJECTS = [
  { name: 'Ingliz tili', price: 450000 },
  { name: 'Matematika', price: 400000 },
  { name: 'IT / Dasturlash', price: 600000 },
  { name: 'Rus tili', price: 400000 },
  { name: 'Fizika', price: 420000 },
  { name: 'Robototexnika', price: 550000 },
  { name: 'Rassomchilik', price: 300000 },
  { name: 'Shaxmat', price: 250000 },
  { name: 'Vokal', price: 350000 },
  { name: 'Til tayyorgarligi (IELTS)', price: 650000 },
];

function fullName(gender: 'M' | 'F') {
  const first = gender === 'M' ? pick(MALE_NAMES) : pick(FEMALE_NAMES);
  return `${first} ${pick(SURNAMES)}`;
}
function phoneNumber() {
  return `+998${randInt(90, 99)}${randInt(1000000, 9999999)}`;
}

async function main() {
  await mongoose.connect(process.env.DATABASE_URL as string);
  console.log('🔌 MongoDB’ga ulanildi.');

  const adminPhone = process.env.SEED_ADMIN_PHONE || '+998900000000';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin12345';
  const adminName = process.env.SEED_ADMIN_NAME || 'Bosh administrator';

  const existingAdmin = await User.findOne({ phone: adminPhone });
  if (!existingAdmin) {
    const hashed = await bcrypt.hash(adminPassword, 10);
    // Birinchi hisob SUPERADMIN sifatida yaratiladi — u boshqa barcha admin/rahbar/
    // o'qituvchi login'larini /users bo'limidan qo'sha, tahrirlay va o'chira oladi.
    await User.create({ name: adminName, phone: adminPhone, password: hashed, role: 'SUPERADMIN' });
    console.log(`✅ SUPERADMIN yaratildi: ${adminPhone} / ${adminPassword}`);
  } else {
    console.log('ℹ️  Admin allaqachon mavjud.');
  }

  const existingTeachers = await Teacher.countDocuments();
  if (existingTeachers > 0) {
    console.log(`ℹ️  Bazada allaqachon ${existingTeachers} ta o'qituvchi bor — demo ma'lumot o'tkazib yuborildi.`);
    await mongoose.disconnect();
    return;
  }

  console.log('👩‍🏫 O\'qituvchilar...');
  const teacherCount = 8;
  const teachers = await Promise.all(
    Array.from({ length: teacherCount }).map((_, i) => {
      const gender = Math.random() > 0.45 ? 'F' : 'M';
      const subject = SUBJECTS[i % SUBJECTS.length];
      return Teacher.create({
        fullName: fullName(gender),
        phone: phoneNumber(),
        subject: subject.name,
        salaryPct: randInt(30, 50),
        active: true,
      });
    }),
  );

  console.log('📚 Guruhlar va jadval...');
  const groupLevels = ['Boshlang\'ich', 'O\'rta', 'Yuqori', 'A1', 'A2', 'B1', 'B2', 'Kids'];
  const groupCount = 10;
  const groups: any[] = [];
  for (let i = 0; i < groupCount; i++) {
    const subject = SUBJECTS[i % SUBJECTS.length];
    const teacher = teachers[i % teachers.length];
    const group = await Group.create({
      name: `${subject.name} — ${pick(groupLevels)} ${randInt(1, 9)}`,
      subject: subject.name,
      price: subject.price,
      capacity: randInt(10, 16),
      teacherId: teacher.id,
      room: `${randInt(1, 4)}-xona`,
      active: true,
      studentIds: [],
    });
    groups.push(group);
    const days = pickSome([1, 2, 3, 4, 5, 6], 2);
    const startHour = randInt(9, 18);
    await Promise.all(
      days.map((day) =>
        ScheduleSlot.create({
          groupId: group.id,
          dayOfWeek: day,
          startTime: `${String(startHour).padStart(2, '0')}:00`,
          endTime: `${String(startHour + 1).padStart(2, '0')}:30`,
          room: group.room,
        }),
      ),
    );
  }

  console.log('🎓 O\'quvchilar...');
  const studentCount = 80;
  const students: any[] = [];
  await inChunks(Array.from({ length: studentCount }), 15, async () => {
    const gender = Math.random() > 0.5 ? 'F' : 'M';
    const parentGender = Math.random() > 0.5 ? 'F' : 'M';
    const assignedGroups = pickSome(groups, randInt(1, 2));
    const student = await Student.create({
      fullName: fullName(gender),
      phone: Math.random() > 0.3 ? phoneNumber() : undefined,
      parentName: fullName(parentGender),
      parentPhone: phoneNumber(),
      address: pick(ADDRESSES),
      active: true,
      groupIds: assignedGroups.map((g) => g.id),
    });
    students.push(student);
    for (const g of assignedGroups) g.studentIds.push(student.id);
  });

  console.log('🔗 Guruhlarning o\'quvchi ro\'yxatini yangilash...');
  await inChunks(groups, 5, (g) => Group.updateOne({ _id: g.id }, { studentIds: g.studentIds }));

  console.log('🗓  Darslar va davomat (o\'tgan 14 kun + kelasi 7 kun)...');
  const today = new Date();
  const from = new Date(today.getTime() - 14 * 24 * 3600 * 1000);
  const to = new Date(today.getTime() + 7 * 24 * 3600 * 1000);

  for (const g of groups) {
    const slots = await ScheduleSlot.find({ groupId: g.id });
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const daySlots = slots.filter((s: any) => s.dayOfWeek === dayOfWeek);
      for (const slot of daySlots) {
        const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const isPast = dateOnly < today;
        const lesson = await Lesson.create({
          groupId: g.id,
          date: dateOnly,
          startTime: (slot as any).startTime,
          endTime: (slot as any).endTime,
          status: isPast ? 'COMPLETED' : 'PLANNED',
        });
        if (isPast && g.studentIds.length) {
          await Promise.all(
            g.studentIds.map((studentId: string) => {
              const roll = Math.random();
              const status = roll < 0.82 ? 'PRESENT' : roll < 0.92 ? 'ABSENT' : roll < 0.97 ? 'LATE' : 'EXCUSED';
              return Attendance.create({ lessonId: lesson.id, studentId, status, markedAt: dateOnly });
            }),
          );
        }
      }
    }
  }

  console.log('💳 To\'lovlar (o\'tgan 3 oy)...');
  const groupMap = new Map(groups.map((g) => [g.id, g] as const));
  await inChunks(students, 15, async (student) => {
    for (let m = 2; m >= 0; m--) {
      const periodDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const period = periodOf(periodDate);
      const expected = student.groupIds.reduce((sum: number, gId: string) => sum + (groupMap.get(gId)?.price || 0), 0);
      if (expected === 0) continue;
      const payRoll = Math.random();
      let paidAmount = 0;
      if (payRoll < 0.7) paidAmount = expected;
      else if (payRoll < 0.85) paidAmount = Math.round((expected * randInt(30, 70)) / 100);
      if (paidAmount > 0) {
        await Payment.create({
          studentId: student.id,
          amount: paidAmount,
          method: pick(['CASH', 'CARD', 'PAYME', 'CLICK'] as const),
          periodMonth: period,
          createdAt: new Date(periodDate.getFullYear(), periodDate.getMonth(), randInt(1, 27)),
        });
      }
    }
  });

  console.log('🔗 O\'qituvchilar uchun Telegram kod va namunaviy arizalar...');
  await Promise.all(
    teachers.map((t) => TeacherLink.create({ teacherId: t.id, linkCode: Math.random().toString(36).slice(2, 10).toUpperCase() })),
  );
  const sampleReasons = ['Bemorman, shifokorga borishim kerak', 'Oilaviy sabablarga ko\'ra shaharda emasman', 'Farzandim kasal, ko\'rikka olib borishim kerak', 'Shaxsiy ish yuzasidan bir kunlik ruxsat kerak'];
  await Promise.all(
    Array.from({ length: 6 }).map((_, i) =>
      LeaveRequest.create({
        teacherId: pick(teachers).id,
        reason: pick(sampleReasons),
        status: i < 2 ? 'PENDING' : i < 4 ? 'APPROVED' : 'REJECTED',
        decidedAt: i < 2 ? undefined : new Date(),
        decidedNote: i < 2 ? undefined : i < 4 ? 'Tasdiqlandi, sog\'lom bo\'ling' : 'Bu hafta band, iltimos boshqa kunga rejalashtiring',
      }),
    ),
  );

  console.log('✅ Demo ma\'lumotlar tayyor:');
  console.log(`   O'qituvchilar: ${teachers.length}, Guruhlar: ${groups.length}, O'quvchilar: ${students.length}`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
