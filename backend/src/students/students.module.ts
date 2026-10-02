import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Student, Group, Payment, Attendance } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// Regex'da maxsus ma'noga ega belgilarni ($regex ichida xato yoki noto'g'ri moslashuvga
// olib kelmasligi uchun, masalan telefon qidirishda "+" belgisi) ekranlaymiz.
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- DTO ----------
export class CreateStudentDto {
  fullName: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  birthDate?: string;
  address?: string;
  groupIds?: string[];
}

export class UpdateStudentDto {
  fullName?: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  birthDate?: string;
  address?: string;
  active?: boolean;
  groupIds?: string[];
}

export interface StudentListQuery {
  search?: string;
  groupId?: string;
  onlyActive?: string;
  page?: string;
  limit?: string;
}

// ---------- Xizmat ----------
@Injectable()
export class StudentsService {
  constructor(
    @InjectModel(Student.name) private studentModel: Model<Student>,
    @InjectModel(Group.name) private groupModel: Model<Group>,
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
  ) {}

  async create(dto: CreateStudentDto) {
    const student = await this.studentModel.create({
      fullName: dto.fullName,
      phone: dto.phone,
      parentName: dto.parentName,
      parentPhone: dto.parentPhone,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      address: dto.address,
      groupIds: dto.groupIds || [],
    });

    if (dto.groupIds?.length) {
      await this.syncGroupMembership(student.id, [], dto.groupIds);
    }
    return student;
  }

  // TEACHER faqat o'zi dars beradigan guruhlardagi o'quvchilarni ko'rishi kerak —
  // shuning uchun ixtiyoriy teacherId beriladi, u yerda faqat shu o'qituvchining
  // guruhlariga tegishli o'quvchilar bilan cheklaymiz.
  async findAll(query: StudentListQuery, teacherId?: string) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    const where: any = {};
    if (query.onlyActive === 'true') where.active = true;

    if (teacherId) {
      const teacherGroups = await this.groupModel.find({ teacherId }).select('_id');
      const teacherGroupIds = teacherGroups.map((g) => g.id);
      if (query.groupId) {
        where.groupIds = teacherGroupIds.includes(query.groupId) ? query.groupId : '__none__';
      } else {
        where.groupIds = { $in: teacherGroupIds };
      }
    } else if (query.groupId) {
      where.groupIds = query.groupId;
    }

    if (query.search) {
      const raw = query.search.trim();
      const digits = raw.replace(/\D/g, '');
      const or: any[] = [{ fullName: { $regex: escapeRegex(raw), $options: 'i' } }];
      // Qidiruv matnida kamida 3 ta raqam bo'lsa — telefon bo'yicha ham qidiramiz.
      // Har bir raqam orasida ixtiyoriy raqam bo'lmagan belgilar (bo'shliq, tire, "+",
      // qavs) bo'lishiga ruxsat beramiz, shunda "+998 90 123 45 67", "998901234567",
      // "90-123-45-67" kabi turli formatlar bir xil natija beradi. O'quvchining o'zi
      // yoki ota-onasining telefon raqami bo'yicha ham qidiriladi.
      if (digits.length >= 3) {
        const phonePattern = digits.split('').map(escapeRegex).join('[^0-9]*');
        or.push({ phone: { $regex: phonePattern } });
        or.push({ parentPhone: { $regex: phonePattern } });
      }
      where.$or = or;
    }

    const [data, total] = await Promise.all([
      this.studentModel.find(where).sort({ fullName: 1 }).skip((page - 1) * limit).limit(limit),
      this.studentModel.countDocuments(where),
    ]);

    return { data, total, page, limit, pageCount: Math.max(1, Math.ceil(total / limit)) };
  }

  async findOne(id: string, teacherId?: string) {
    const student = await this.studentModel.findById(id);
    if (!student) throw new NotFoundException('O‘quvchi topilmadi');

    if (teacherId) {
      const teacherGroups = await this.groupModel.find({ teacherId }).select('_id');
      const teacherGroupIds = new Set(teacherGroups.map((g) => g.id));
      const overlap = student.groupIds.some((gId) => teacherGroupIds.has(gId));
      if (!overlap) {
        throw new ForbiddenException("Faqat o'zingizning guruhingizdagi o'quvchilarni ko'rishingiz mumkin");
      }
    }

    const groups = student.groupIds.length ? await this.groupModel.find({ _id: { $in: student.groupIds } }) : [];
    const payments = await this.paymentModel.find({ studentId: id }).sort({ createdAt: -1 });
    const attendances = await this.attendanceModel.find({ studentId: id }).sort({ markedAt: -1 }).limit(30);

    return { ...student.toObject(), groups, payments, attendances };
  }

  async update(id: string, dto: UpdateStudentDto) {
    const existing = await this.studentModel.findById(id);
    if (!existing) throw new NotFoundException('O‘quvchi topilmadi');

    if (dto.groupIds) {
      await this.syncGroupMembership(id, existing.groupIds, dto.groupIds);
    }

    const update: any = { ...dto };
    if (dto.birthDate) update.birthDate = new Date(dto.birthDate);

    return this.studentModel.findByIdAndUpdate(id, update, { new: true });
  }

  async remove(id: string) {
    const existing = await this.studentModel.findById(id);
    if (!existing) throw new NotFoundException('O‘quvchi topilmadi');
    await this.syncGroupMembership(id, existing.groupIds, []);
    return this.studentModel.findByIdAndDelete(id);
  }

  /** Guruh <-> o'quvchi ikki tomonlama massivlarini sinxronlash */
  private async syncGroupMembership(studentId: string, oldGroupIds: string[], newGroupIds: string[]) {
    const toAdd = newGroupIds.filter((g) => !oldGroupIds.includes(g));
    const toRemove = oldGroupIds.filter((g) => !newGroupIds.includes(g));

    if (toAdd.length) {
      await this.groupModel.updateMany({ _id: { $in: toAdd } }, { $addToSet: { studentIds: studentId } });
    }
    if (toRemove.length) {
      await this.groupModel.updateMany({ _id: { $in: toRemove } }, { $pull: { studentIds: studentId } });
    }
  }
}

// ---------- Controller ----------
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private studentsService: StudentsService) {}

  @Roles('SUPERADMIN', 'ADMIN')
  @Post()
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  @Get()
  findAll(@Query() query: StudentListQuery, @CurrentUser() currentUser: { role: string; teacherId?: string }) {
    const teacherId = currentUser.role === 'TEACHER' ? currentUser.teacherId : undefined;
    return this.studentsService.findAll(query, teacherId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: { role: string; teacherId?: string }) {
    const teacherId = currentUser.role === 'TEACHER' ? currentUser.teacherId : undefined;
    return this.studentsService.findOne(id, teacherId);
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(id, dto);
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.studentsService.remove(id);
  }
}

// ---------- Modul ----------
@Module({
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
