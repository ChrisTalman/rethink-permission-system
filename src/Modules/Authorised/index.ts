'use strict';

// External Modules
import { r as RethinkDB } from 'rethinkdb-ts';
import { run as rethinkRun } from '@chris-talman/rethink-utilities';

// Internal Modules
import { PermissionSystem } from 'src/Modules';
import { generateUserVariablesQuery } from 'src/Modules/UserVariables';
import { generateUserAuthorisedByRangeQuery } from './Range';
import { generateUserAuthorisedBySubjectQuery } from './Subject';

// Types
import { RDatum } from 'rethinkdb-ts';
import { PermissionTargetEntity } from 'src/Modules';
import { UserVariables } from 'src/Modules/UserVariables';
interface PermissionParameters <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> extends Array<PermissionParameter <GenericPermissionType, GenericSubjectTargetEntityType>> {};
type PermissionParameter <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> = RangePermissionParameter <GenericPermissionType> | SubjectPermissionParameter <GenericPermissionType, GenericSubjectTargetEntityType>;
interface RangePermissionParameter <GenericPermissionType extends string>
{
	range:
	{
		types: Array<GenericPermissionType>;
	};
};
interface SubjectPermissionParameter <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string>
{
	subject:
	{
		type: GenericPermissionType;
		entity: PermissionTargetEntity <GenericSubjectTargetEntityType>;
	};
};
export interface PermissionParameterEvaluation
{
	granted: boolean;
	negated: boolean;
	authorised: boolean;
};
export interface AggregatePermissionEvaluation
{
	authorised: boolean;
	negated: boolean;
};

/** Determines whether the user has at least one permission in a range of possible permission types. */
export async function isUserAuthorised <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string>
(
	this: PermissionSystem <any, any, any, any>,
	{domainId, userId, permissions}: {domainId: string, userId: string, permissions: PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>}
)
{
	const query = generateQuery({domainId, userId, permissions, system: this});
	const authorised = await rethinkRun({query, options: {throwRuntime: false}}) as boolean;
	return authorised;
};

export function generateIsUserAuthorisedQuery <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string>
(
	this: PermissionSystem <any, any, any, any>,
	{domainId, userId, permissions}: {domainId: string, userId: string, permissions: PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>}
)
{
	const query = generateQuery({domainId, userId, permissions, system: this});
	return query;
};

function generateQuery <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string>
(
	{domainId, userId, permissions, system}: {domainId: string, userId: string, permissions: PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>, system: PermissionSystem <any, any, any, any>}
)
{
	const query = generateUserVariablesQuery({domainId, userId, system})
		.do
		(
			(variables: RDatum <UserVariables <any>>) => RethinkDB
				.or
				(
					system.queries.globalAuthorised ? system.queries.globalAuthorised({domainId, userId, user: variables('user')}) : false,
					RethinkDB.and
					(
						system.queries.organisationAuthorised ? system.queries.organisationAuthorised({domainId, userId, user: variables('user')}) : true,
						system.queries.userRoles({domainId, userId, user: variables('user')})
							.do
							(
								(userRoles: ReturnType<typeof system.queries.userRoles>) =>
								(
									RethinkDB
										.expr
										(
											permissions
												.map
												(
													permission =>
													{
														if ('range' in permission)
														{
															return generateUserAuthorisedByRangeQuery({domainId, userRoles, permissions: permission.range.types, system});
														}
														else if ('subject' in permission)
														{
															return generateUserAuthorisedBySubjectQuery({domainId, userRoles, permission: permission.subject.type, subject: permission.subject.entity, system})
														}
														else
														{
															throw new Error(`Expected properties 'range' or 'subject', but got neither`);
														};
													}
												)
										)
										.do
										(
											(evaluations: any) => RethinkDB
												.expr
												(
													{
														authorised: evaluations
															.filter((evaluation: RDatum <AggregatePermissionEvaluation>) => evaluation('authorised'))
															.count()
															.gt(0),
														negated: evaluations
															.filter((evaluation: RDatum <AggregatePermissionEvaluation>) => evaluation('negated'))
															.count()
															.eq(0)
													}
												)
												.do
												(
													(evaluation: RDatum <AggregatePermissionEvaluation>) => RethinkDB.and
													(
														evaluation('authorised').eq(true),
														evaluation('negated').eq(false)
													)
												)
										)
								)
							)
					)
				)
		);
	return query;
};