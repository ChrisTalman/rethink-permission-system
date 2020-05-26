declare module '@chris-talman/rethink-permission-systems'
{
	// Types
	import { RDatum } from 'rethinkdb-ts';

	// Class
	export interface Queries <GenericUser extends any, GenericPermissionTargetEntityType extends string>
	{
		user: ({domainId, userId}: {domainId: string, userId: string}) => RDatum<GenericUser>;
		globalAuthorised?: ({domainId, userId, user}: {domainId: string, userId: string, user: RDatum<GenericUser>}) => RDatum <boolean>;
		organisationAuthorised?: ({domainId, userId, user}: {domainId: string, userId: string, user: RDatum<GenericUser>}) => RDatum <boolean>;
		userRoles: ({domainId, userId, user}: {domainId: string, userId: string, user: RDatum<GenericUser>}) => RDatum <UserRoles <GenericPermissionTargetEntityType>>;
	}
	export interface Indexes
	{
		/** [ domainId, permission type, negated, user role ID, user role type, deleted ] */
		range: string;
		/** [ domainId, permission type, negated, user role ID, user role type, subject entity ID, subject entity type, deleted ] */
		subject: string;
	}
	export interface PermissionTargetEntity <PermissionTargetEntityType extends string>
	{
		id: string;
		type: PermissionTargetEntity <PermissionTargetEntityType>;
	}
	interface UserRoles <PermissionTargetEntityType extends string> extends Array<UserRole <PermissionTargetEntityType>> {}
	interface UserRole <PermissionTargetEntityType extends string>
	{
		id: RDatum<string>;
		type: PermissionTargetEntityType;
	}
	export class PermissionSystem <GenericUser extends any, GenericPermissionTypes extends Array<string>, GenericPermissionTargetEntityType extends string, GenericTargetEntity extends PermissionTargetEntity <GenericPermissionTargetEntityType>>
	{
		public readonly table: string;
		public readonly indexes: Indexes;
		public readonly queries: Queries <GenericUser, GenericPermissionTargetEntityType>;
		public isUserAuthorisedByRange <GenericPermissionTypes extends Array<string>> ({domainId, userId, permissions}: {domainId: string, userId: string, permissions: GenericPermissionTypes}): Promise<boolean>;
		public isUserAuthorisedBySubject <GenericPermissionTypes extends Array<string>, GenericTargetEntity extends PermissionTargetEntity <any>> ({domainId, userId, permission, subject}: {domainId: string, userId: string, permission: GenericPermissionTypes, subject: GenericTargetEntity}): Promise<boolean>;
		constructor({table, indexes, queries}: {table: string, indexes: Indexes, queries: Queries <GenericUser, GenericPermissionTargetEntityType>});
	}
}