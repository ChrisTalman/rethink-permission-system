'use strict';

// Internal Modules
import { isUserAuthorised, generateIsUserAuthorisedQuery } from './UserAuthorised';
import { getAuthorisedAgents } from './AuthorisedAgents';

// Types
import { RDatum } from 'rethinkdb-ts';
import { OmitLiteral } from '@chris-talman/types-helpers';
import { PermissionParameters } from './UserAuthorised';
export interface Queries <GenericUser extends any, GenericTargetEntityType extends string, GenericSubjectTargetEntityType extends string>
{
	user: ({domainId, userId}: {domainId: string | RDatum <string>, userId: string | RDatum <string>}) => RDatum<GenericUser>;
	globalAuthorised?: ({domainId, userId, user}: {domainId: string | RDatum <string>, userId: string | RDatum <string>, user: RDatum<GenericUser>}) => RDatum <boolean>;
	getGlobalAuthorisedAgents?: ({domainId}: {domainId: string | RDatum <string>}) => RDatum <PermissionTargetEntity <GenericTargetEntityType>>;
	organisationAuthorised?: ({domainId, userId, user}: {domainId: string | RDatum <string>, userId: string | RDatum <string>, user: RDatum <GenericUser>}) => RDatum <boolean>;
	getOrganisationAuthorisedAgents?: ({domainId}: {domainId: string | RDatum <string>}) => RDatum <PermissionTargetEntity <GenericTargetEntityType>>;
	userRoles: ({domainId, userId, user}: {domainId: string | RDatum <string>, userId: string | RDatum <string>, user: RDatum<GenericUser>}) => RDatum <UserRoles <GenericTargetEntityType>>;
	/** For `subject` authorisations, evaluates multiple subjects based upon the input subject. */
	subjectEntities?: ({entity}: {entity: RDatum <PermissionTargetEntity <GenericSubjectTargetEntityType>>}) => RDatum <Array <PermissionTargetEntity <GenericSubjectTargetEntityType>>>;
};
interface Indexes
{
	/** [ domainId, permission type, negated, user role ID, user role type, deleted ] */
	range: string;
	/** [ domainId, permission type, negated, user role ID, user role type, subject entity ID, subject entity type, deleted ] */
	subject: string;
	/** [ domainId, permission type, deleted ] */
	simplePermission: string;
	/** [ domainId, permission type, subject entity ID, subject entity type, deleted ] */
	subjectPermission: string;
};
export interface Permissions <PermissionTargetEntityType extends string> extends Array<Permission <PermissionTargetEntityType>> {};
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
};
export interface PermissionTargetEntity <PermissionTargetEntityType extends string>
{
	id: string;
	type: PermissionTargetEntityType;
};
export interface UserRoles <PermissionTargetEntityType extends string> extends Array<UserRole <PermissionTargetEntityType>> {};
interface UserRole <PermissionTargetEntityType extends string>
{
	id: RDatum <string>;
	type: PermissionTargetEntityType;
};
export type GroupPermissions <GenericPermissionType extends string> =
{
	[Type in GenericPermissionType]?: Array <OmitLiteral <GenericPermissionType, Type>>;
};

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
	public readonly isUserAuthorised = isUserAuthorised;
	public readonly generateIsUserAuthorisedQuery = generateIsUserAuthorisedQuery;
	public readonly getAuthorisedAgents = getAuthorisedAgents;
	public readonly globalPermissions?: PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>;
	public readonly groupPermissions?: GroupPermissions <GenericPermissionType>;
	constructor({table, indexes, queries, globalPermissions, groupPermissions}: {table: string, indexes: Indexes, queries: Queries <GenericUser, GenericTargetEntityType, GenericSubjectTargetEntityType>, globalPermissions?: PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>, groupPermissions?: GroupPermissions <GenericPermissionType>})
	{
		this.table = table;
		this.indexes = indexes;
		this.queries = queries;
		if (globalPermissions) this.globalPermissions = globalPermissions;
		if (groupPermissions) this.groupPermissions = groupPermissions;
	};
};