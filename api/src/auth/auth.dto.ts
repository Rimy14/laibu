import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class SignupDto {
  @IsIn(['author', 'publisher', 'buyer'], { message: 'Choose how you will use Laibu.' })
  role!: 'author' | 'publisher' | 'buyer';

  @IsString()
  @Length(2, 120, { message: 'Enter your full name.' })
  full_name!: string;

  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @MaxLength(128)
  password!: string;

  @IsString({ message: 'Please accept the Terms of Use.' })
  @MaxLength(20)
  accept_terms_version!: string;

  @IsString({ message: 'Please accept the Privacy Policy.' })
  @MaxLength(20)
  accept_policy_version!: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(1, 128, { message: 'Enter your password.' })
  password!: string;
}

export class RefreshDto {
  /** Non-browser clients send the refresh token in the body; browsers use the cookie. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  refresh_token?: string;
}

export class AcceptTermsDto {
  @IsString()
  @MaxLength(20)
  accept_terms_version!: string;

  @IsString()
  @MaxLength(20)
  accept_policy_version!: string;
}
