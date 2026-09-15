import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth-user';
import { ShopService } from './shop.service';
import { CreateOperationTypeDto, CreatePostDto, PatchPostDto } from './dto';

@Controller()
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Roles(Role.ADMIN, Role.TECHNOLOGIST, Role.DISPATCHER, Role.OPERATOR)
  @Get('posts')
  listPosts(@CurrentUser() user: AuthUser, @Query('active') active?: string) {
    return this.shop.listPosts(user.tenantId, active === '1');
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Post('posts')
  createPost(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    return this.shop.createPost(user.tenantId, dto);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Patch('posts/:id')
  patchPost(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PatchPostDto,
  ) {
    return this.shop.patchPost(user.tenantId, id, dto);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST, Role.DISPATCHER)
  @Get('operation-types')
  listTypes(@CurrentUser() user: AuthUser) {
    return this.shop.listOperationTypes(user.tenantId);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Post('operation-types')
  createType(@CurrentUser() user: AuthUser, @Body() dto: CreateOperationTypeDto) {
    return this.shop.createOperationType(user.tenantId, dto);
  }

  @Roles(Role.ADMIN, Role.TECHNOLOGIST)
  @Delete('operation-types/:id')
  removeType(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shop.removeOperationType(user.tenantId, id);
  }
}
