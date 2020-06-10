declare module '@chris-talman/rethink-permission-system'
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
	export interface Permissions <PermissionTargetEntityType extends string> extends Array<Permission <PermissionTargetEntityType>> {}
	export interface Permission <PermissionTargetEntityType extends string>
	{
		id: string;
		type: string;
		domainId: string;
		/** The entity which is authorised to take an action. */
		agent: PermissionTargetEntity <PermissionTargetEntityType>;
		/** The entity on which the agent entity can take an action. */
		subject?: PermissionTargetEntity <PermissionTargetEntityType>;
		/** Determines whether permission should be denied for agent, negating any other permissions granting permission. */
		negated?: boolean;
		deleted?: true;
	}
	export interface PermissionTargetEntity <PermissionTargetEntityType extends string>
	{
		id: string;
		type: PermissionTargetEntityType;
	}
	interface UserRoles <PermissionTargetEntityType extends string> extends Array<UserRole <PermissionTargetEntityType>> {}
	interface UserRole <PermissionTargetEntityType extends string>
	{
		id: RDatum<string>;
		type: PermissionTargetEntityType;
	}
	export class PermissionSystem
	<
		GenericUser extends any,
		GenericPermissionType extends string,
		GenericTargetEntityType extends string,
		GenericSubjectTargetEntityType extends string
	>
	{
		public readonly table: string;
		public readonly indexes: Indexes;
		public readonly queries: Queries <GenericUser, GenericTargetEntityType>;
		public isUserAuthorised({domainId, userId, permissions}: {domainId: string, userId: string, permissions: IsUserAuthorised.PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>}): Promise <boolean>;
		public generateIsUserAuthorisedQuery <GenericPermissions extends IsUserAuthorised.PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>> ({domainId, userId, permissions}: {domainId: string, userId: string, permissions: GenericPermissions | RDatum <GenericPermissions>}): RDatum <boolean>;
		constructor({table, indexes, queries}: {table: string, indexes: Indexes, queries: Queries <GenericUser, GenericTargetEntityType>});
	}

	// Is User Authorised
	export namespace IsUserAuthorised
	{
		export interface PermissionParameters <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> extends Array<PermissionParameter <GenericPermissionType, GenericSubjectTargetEntityType>> {}
		export type PermissionParameter <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> = RangePermissionParameter <GenericPermissionType> | SubjectPermissionParameter <GenericPermissionType, GenericSubjectTargetEntityType>;
		export interface RangePermissionParameter <GenericPermissionType extends string>
		{
			range:
			{
				types: Array<GenericPermissionType>;
			};
		}
		export interface SubjectPermissionParameter <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string>
		{
			subject:
			{
				type: GenericPermissionType;
				entity: PermissionTargetEntity <GenericSubjectTargetEntityType>;
			};
		}
	}
}