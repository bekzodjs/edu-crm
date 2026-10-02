import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Injectable,
  Module,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as bcrypt from 'bcryptjs';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { User } from '../database/schemas';
import { AppRole } from '../common/decorators/roles.decorator';

// ---------- DTO ----------
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @MinLength(4)
  password: string;
}

// Parolni tanlab topishga (brute-force) qarshi oddiy cheklov: bitta telefon raqam uchun
// LOGIN_WINDOW_MS ichida LOGIN_MAX_FAILS martadan ko'p xato urinish bo'lsa, vaqtincha bloklanadi.
const LOGIN_MAX_FAILS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// ---------- JWT payload turi ----------
export interface JwtPayload {
  sub: string;
  phone: string;
  role: AppRole;
  teacherId?: string;
}

// ---------- JWT strategiyasi ----------
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'dev-secret',
    });
  }

  // Har bir so'rovda foydalanuvchi bazadan tekshiriladi: o'chirilgan hisob token muddati
  // tugashini kutmasdan darhol kirolmay qoladi, rol o'zgargan bo'lsa yangi rol amal qiladi.
  async validate(payload: JwtPayload) {
    const user = await this.userModel.findById(payload.sub).select('phone role teacherId');
    if (!user) throw new UnauthorizedException('Hisob topilmadi yoki o‘chirilgan');
    return { userId: user.id, phone: user.phone, role: user.role as AppRole, teacherId: user.teacherId };
  }
}

// ---------- Auth xizmati ----------
// Eslatma: yangi hisob (admin/rahbar/o'qituvchi login'i) yaratish endi ochiq /auth/register
// orqali emas, faqat SUPERADMIN kira oladigan /users moduli orqali amalga oshiriladi.
@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwt: JwtService,
  ) {}

  private failedLogins = new Map<string, { count: number; firstAt: number }>();

  private assertNotLocked(phone: string) {
    const entry = this.failedLogins.get(phone);
    if (!entry) return;
    if (Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
      this.failedLogins.delete(phone);
      return;
    }
    if (entry.count >= LOGIN_MAX_FAILS) {
      throw new HttpException(
        'Juda ko‘p noto‘g‘ri urinish. Iltimos, 15 daqiqadan so‘ng qayta urinib ko‘ring.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private registerFailure(phone: string) {
    const entry = this.failedLogins.get(phone);
    if (!entry || Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
      this.failedLogins.set(phone, { count: 1, firstAt: Date.now() });
    } else {
      entry.count++;
    }
  }

  async login(dto: LoginDto) {
    // Hisoblar yaratilganda telefon trim qilinadi — login'da ham shunday qilamiz.
    const phone = dto.phone.trim();
    this.assertNotLocked(phone);

    const user = await this.userModel.findOne({ phone });
    const ok = user ? await bcrypt.compare(dto.password, user.password) : false;
    if (!user || !ok) {
      this.registerFailure(phone);
      throw new UnauthorizedException('Telefon yoki parol noto‘g‘ri');
    }
    this.failedLogins.delete(phone);

    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role as AppRole,
      teacherId: user.teacherId,
    };
    const token = await this.jwt.signAsync(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        teacherId: user.teacherId,
        avatarUrl: user.avatarUrl,
      },
    };
  }
}

// ---------- Auth controller ----------
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}

// ---------- Auth moduli ----------
@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'dev-secret',
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') || '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
