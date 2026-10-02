import { Body, Controller, Injectable, Module, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PassportStrategy } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as bcrypt from 'bcryptjs';
import { IsString, MinLength } from 'class-validator';
import { User } from '../database/schemas';
import { AppRole } from '../common/decorators/roles.decorator';

export class LoginDto {
  @IsString()
  phone: string;

  @IsString()
  @MinLength(4)
  password: string;
}

export interface JwtPayload {
  sub: string;
  phone: string;
  role: AppRole;
  teacherId?: string;
}

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

  async validate(payload: JwtPayload) {
    const user = await this.userModel.findById(payload.sub).select('phone role teacherId');
    if (!user) throw new UnauthorizedException('Hisob topilmadi yoki o‘chirilgan');
    return { userId: user.id, phone: user.phone, role: user.role as AppRole, teacherId: user.teacherId };
  }
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ phone: dto.phone });
    if (!user) throw new UnauthorizedException('Telefon yoki parol noto‘g‘ri');

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Telefon yoki parol noto‘g‘ri');

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

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}

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
