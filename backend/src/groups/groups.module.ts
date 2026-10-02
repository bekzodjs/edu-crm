import {
  BadRequestException,
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
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Group, Teacher, Student, ScheduleSlot } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty({ message: 'Guruh nomi kiritilishi shart' })
  @MaxLength(200)
  name: string;

  @IsOptional() @IsString() @MaxLength(100) subject?: string;

  @IsNumber({}, { message: "Narx son bo'lishi kerak" })
  @Min(0, { message: "Narx manfiy bo'lishi mumkin emas" })
  price: number;

  @IsOptional() @IsInt() @Min(1) @Max(1000) capacity?: number;

  @IsString()
  @IsNotEmpty({ message: "O'qituvchi tanlanishi shart" })
  teacherId: string;

  @IsOptional() @IsString() @MaxLength(50) room?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(100) salaryPct?: number;
}

export class UpdateGroupDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(100) subject?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000) capacity?: number;
  @IsOptional() @IsString() @IsNotEmpty() teacherId?: string;
  @IsOptional() @IsString() @MaxLength(50) room?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  // null = guruhga xos maosh foizini bekor qilish (o'qituvchining standart foiziga qaytish)
  @IsOptional() @IsNumber() @Min(0) @Max(100) salaryPct?: number | null;
}

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<Group>,
    @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
    @InjectModel(Student.name) private studentModel: Model<Student>,
    @InjectModel(ScheduleSlot.name) private scheduleSlotModel: Model<ScheduleSlot>,
  ) {}

  private async assertTeacherExists(teacherId: string) {
    const teacher = await this.teacherModel.findById(teacherId);
    if (!teacher) throw new BadRequestException("Tanlangan o'qituvchi topilmadi");
  }

  async create(dto: CreateGroupDto) {
    await this.assertTeacherExists(dto.teacherId);
    return this.groupModel.create({
      name: dto.name,
      subject: dto.subject,
      price: dto.price,
      capacity: dto.capacity ?? 20,
      teacherId: dto.teacherId,
      room: dto.room,
      salaryPct: dto.salaryPct,
      studentIds: [],
    });
  }

  // TEACHER faqat o'zining guruhlarini ko'rishi kerak (boshqa o'qituvchilarning
  // guruh narxi, maosh foizi va h.k.ni ko'rmasligi uchun) — shuning uchun
  // ixtiyoriy teacherId filtri qo'shildi.
  findAll(teacherId?: string) {
    const where: any = {};
    if (teacherId) where.teacherId = teacherId;
    return this.groupModel.find(where).sort({ name: 1 });
  }

  async findOne(id: string) {
    const group = await this.groupModel.findById(id);
    if (!group) throw new NotFoundException('Guruh topilmadi');
    const teacher = await this.teacherModel.findById(group.teacherId);
    const students = group.studentIds.length
      ? await this.studentModel.find({ _id: { $in: group.studentIds } })
      : [];
    const scheduleSlots = await this.scheduleSlotModel.find({ groupId: id });
    return { ...group.toObject(), teacher, students, scheduleSlots };
  }

  async update(id: string, dto: UpdateGroupDto) {
    const group = await this.groupModel.findById(id);
    if (!group) throw new NotFoundException('Guruh topilmadi');
    if (dto.teacherId && dto.teacherId !== group.teacherId) await this.assertTeacherExists(dto.teacherId);
    const { salaryPct, ...rest } = dto;
    Object.assign(group, rest);
    if (salaryPct === null) group.salaryPct = undefined;
    else if (salaryPct !== undefined) group.salaryPct = salaryPct;
    await group.save();
    return group;
  }

  async remove(id: string) {
    const group = await this.groupModel.findById(id);
    if (!group) throw new NotFoundException('Guruh topilmadi');
    if (group.studentIds.length) {
      await this.studentModel.updateMany(
        { _id: { $in: group.studentIds } },
        { $pull: { groupIds: id } },
      );
    }
    // Guruhning haftalik jadvali ham u bilan birga o'chadi (aks holda yangi darslar
    // mavjud bo'lmagan guruh uchun generatsiya qilinaverardi).
    await this.scheduleSlotModel.deleteMany({ groupId: id });
    await group.deleteOne();
    return group;
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('groups')
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Roles('SUPERADMIN', 'ADMIN')
  @Post()
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @Get()
  findAll(@CurrentUser() currentUser: { role: string; teacherId?: string }) {
    const teacherId = currentUser.role === 'TEACHER' ? currentUser.teacherId : undefined;
    return this.groupsService.findAll(teacherId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() currentUser: { role: string; teacherId?: string }) {
    const group = await this.groupsService.findOne(id);
    if (currentUser.role === 'TEACHER' && group.teacherId !== currentUser.teacherId) {
      throw new ForbiddenException("Faqat o'zingizning guruhingizni ko'rishingiz mumkin");
    }
    return group;
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.groupsService.remove(id);
  }
}

@Module({
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
