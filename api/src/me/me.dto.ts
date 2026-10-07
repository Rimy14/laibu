import { IsIn, IsOptional, IsString, Length, MaxLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 120, { message: 'Enter your full name.' })
  full_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

export class PayoutMethodDto {
  @IsIn(['mpesa', 'bank'], { message: 'Choose M-Pesa or bank.' })
  type!: 'mpesa' | 'bank';

  @IsString()
  @Length(2, 120, { message: 'Enter the name on the account.' })
  account_name!: string;

  @ValidateIf((o: PayoutMethodDto) => o.type === 'mpesa')
  @IsString({ message: 'Enter your M-Pesa number.' })
  @MaxLength(20)
  mpesa_phone?: string;

  @ValidateIf((o: PayoutMethodDto) => o.type === 'bank')
  @IsString({ message: 'Enter your bank name.' })
  @Length(2, 80, { message: 'Enter your bank name.' })
  bank_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bank_branch?: string;

  @ValidateIf((o: PayoutMethodDto) => o.type === 'bank')
  @IsString({ message: 'Enter your account number.' })
  @MaxLength(30)
  bank_account?: string;

  /** Changing where money goes requires the password again (account-takeover defence). */
  @IsString({ message: 'Enter your password to confirm.' })
  @Length(1, 128, { message: 'Enter your password to confirm.' })
  current_password!: string;
}
