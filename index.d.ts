declare module '@chris-talman/rethink-permission-system'
{
	// Types
	import { OmitLiteral } from '@chris-talman/types-helpers';
	import { RDatum } from 'rethinkdb-ts';

	// Class
	export interface Queries <GenericUser extends any, GenericPermissionTargetEntityType extends string, GenericSubjectTargetEntityType extends string>
	{
		user: ({domainId, userId}: {domainId: string | RDatum <string>, userId: string | RDatum <string>}) => RDatum<GenericUser>;
		globalAuthorised?: ({domainId, userId, user}: {domainId: string | RDatum <string>, userId: string | RDatum <string>, user: RDatum<GenericUser>}) => RDatum <boolean>;
		getGlobalAuthorisedAgents?: ({domainId}: {domainId: string | RDatum <string>}) => RDatum <PermissionTargetEntity <GenericPermissionTargetEntityType>>;
		organisationAuthorised?: ({domainId, userId, user}: {domainId: string | RDatum <string>, userId: string | RDatum <string>, user: RDatum<GenericUser>}) => RDatum <boolean>;
		getOrganisationAuthorisedAgents?: ({domainId}: {domainId: string | RDatum <string>}) => RDatum <PermissionTargetEntity <GenericPermissionTargetEntityType>>;
		userRoles: ({domainId, userId, user}: {domainId: string | RDatum <string>, userId: string | RDatum <string>, user: RDatum<GenericUser>}) => RDatum <UserRoles <GenericPermissionTargetEntityType>>;
		/** For `subject` authorisations, evaluates multiple subjects based upon the input subject. */
		subjectEntities?: ({entity}: {entity: RDatum <PermissionTargetEntity <GenericSubjectTargetEntityType>>}) => RDatum <Array <PermissionTargetEntity <GenericSubjectTargetEntityType>>>;
	}
	export interface Indexes
	{
		/** [ domainId, permission type, negated, user role ID, user role type, deleted ] */
		range: string;
		/** [ domainId, permission type, negated, user role ID, user role type, subject entity ID, subject entity type, deleted ] */
		subject: string;
		/** [ domainId, permission type, deleted ] */
		simplePermission: string;
		/** [ domainId, permission type, subject entity ID, subject entity type, deleted ] */
		subjectPermission: string;
	}
	export interface Permissions <PermissionTargetEntityType extends string> extends Array <Permission <PermissionTargetEntityType>> {}
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
		/**
			This can be a special value instead of an actual ID.
			Current special values: `@all`.
		*/
		id: string;
		type: PermissionTargetEntityType;
	}
	interface UserRoles <PermissionTargetEntityType extends string> extends Array<UserRole <PermissionTargetEntityType>> {}
	interface UserRole <PermissionTargetEntityType extends string>
	{
		id: RDatum <string>;
		type: PermissionTargetEntityType;
	}
	export type GroupPermissions <GenericPermissionType extends string> =
	{
		[Type in GenericPermissionType]?: Array <OmitLiteral <GenericPermissionType, Type>>;
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
		public readonly queries: Queries <GenericUser, GenericTargetEntityType, GenericSubjectTargetEntityType>;
		public readonly globalPermissions?: IsUserAuthorised.PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>;
		public readonly groupPermissions?: GroupPermissions <GenericPermissionType>;
		public isUserAuthorised({domainId, userId, permissions}: {domainId: string | RDatum <string>, userId: string | RDatum <string>, permissions: IsUserAuthorised.PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>}): Promise <boolean>;
		public generateIsUserAuthorisedQuery <GenericPermissions extends IsUserAuthorised.PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>> ({domainId, userId, permissions}: {domainId: string | RDatum <string>, userId: string | RDatum <string>, permissions: GenericPermissions}): RDatum <boolean>;
		public getAuthorisedAgents({domainId, permissions}: {domainId: string, permissions: GetAuthorisedAgents.PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>}): Promise <Array <PermissionTargetEntity <GenericTargetEntityType>>>;
		constructor({table, indexes, queries, globalPermissions, groupPermissions}: {table: string, indexes: Indexes, queries: Queries <GenericUser, GenericTargetEntityType, GenericSubjectTargetEntityType>, globalPermissions?: IsUserAuthorised.PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>, groupPermissions?: GroupPermissions <GenericPermissionType>});
	}

	// Is User Authorised
	export namespace IsUserAuthorised
	{
		export interface PermissionParameters <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> extends Array<PermissionParameter <GenericPermissionType, GenericSubjectTargetEntityType>> {}
		export type PermissionParameter <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> = RangePermissionParameter <GenericPermissionType> | SubjectPermissionParameter <GenericPermissionType, GenericSubjectTargetEntityType>;
		interface BasePermissionParameter
		{
			/**
				At least one permission must be authorised, but not necessarily this one.
				Can be grouped by a `string`, requiring one permission with that `string` to be authorised.
			*/
			some?: boolean | string;
		}
		export interface RangePermissionParameter <GenericPermissionType extends string>
		{
			range: RangePermissionParameterRange <GenericPermissionType>;
		}
		export interface RangePermissionParameterRange <GenericPermissionType extends string> extends BasePermissionParameter
		{
			types: Array <GenericPermissionType>;
		}
		export interface SubjectPermissionParameter <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string>
		{
			subject: SubjectPermissionParameterSubject <GenericPermissionType, GenericSubjectTargetEntityType>;
		}
		export interface SubjectPermissionParameterSubject <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> extends BasePermissionParameter
		{
			type: GenericPermissionType;
			entity: PermissionTargetEntity <GenericSubjectTargetEntityType>;
		}
	}

	// Get Authorised Agents
	export namespace GetAuthorisedAgents
	{
		export interface PermissionParameters <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> extends Array <PermissionParameter <GenericPermissionType, GenericSubjectTargetEntityType>> {}
		export interface PermissionParameter <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string>
		{
			type: GenericPermissionType;
			subject?: PermissionTargetEntity <GenericSubjectTargetEntityType>;
			/**
				At least one permission must be authorised, but not necessarily this one.
				Can be grouped by a `string`, requiring one permission with that `string` to be authorised.
			*/
			some?: boolean | string;
		}
	}
}